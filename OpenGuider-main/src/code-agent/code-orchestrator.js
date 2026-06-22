const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { invokeStructuredChain } = require("../agent/llm-client");
const { CodeAgentPlanSchema, CodeAgentActSchema } = require("./code-schemas");
const { CODE_AGENT_SYSTEM_RULES } = require("./code-agent-rules");
const { createEmptySession, readSession, writeSession, clearSession } = require("./code-session-state");
const { executeCodeTool, applyPendingChange } = require("./code-tools");
const { retrieveContext } = require("./codebase-retriever");
const { buildCodeIndex } = require("./codebase-indexer");
const { countChangedLines } = require("./patch-engine");
const { BudgetExceededError } = require("../sauron/finops/llm-tracker");
const { streamAIResponse } = require("../ai/index");

const PLAN_TEMPLATE = `
Goal:
{{goal}}

Workspace context:
{{context}}

Return JSON:
{
  "summary": "short plan summary",
  "steps": ["step 1", "step 2"],
  "complexityHint": "low"
}
`;

const ACT_TEMPLATE = `
Goal:
{{goal}}

Plan:
{{plan}}

Recent tool results:
{{toolLog}}

Iteration: {{iteration}} / {{maxIterations}}

Available tools: read_file, write_file, search_replace, list_directory, grep_workspace, run_terminal, git_status, git_diff

Return JSON:
{
  "action": "tool",
  "tool": "read_file",
  "args": { "path": "relative/path" },
  "message": "why this step"
}

Or when done:
{
  "action": "finish",
  "finishSummary": "what was accomplished"
}
`;

/** @type {Map<string, { resolve: Function, reject: Function }>} */
const pendingApprovals = new Map();

function needsApprovalForChange(settings, change) {
  const trust = settings.trustLevel || "balanced";
  if (trust === "autopilot") {
    return false;
  }
  if (trust === "paranoid") {
    return true;
  }
  const changedLines = countChangedLines(change.before, change.after);
  return changedLines > 30 || change.isNew;
}

function waitForApproval(sessionId, timeoutMs = 120000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingApprovals.delete(sessionId);
      reject(new Error("Diff approval timed out."));
    }, timeoutMs);
    pendingApprovals.set(sessionId, {
      resolve: (approved) => {
        clearTimeout(timer);
        pendingApprovals.delete(sessionId);
        resolve(approved);
      },
      reject: (err) => {
        clearTimeout(timer);
        pendingApprovals.delete(sessionId);
        reject(err);
      },
    });
  });
}

function resolveApproval(sessionId, approved) {
  const pending = pendingApprovals.get(sessionId);
  if (pending) {
    pending.resolve(approved);
    return true;
  }
  return false;
}

function emit(deps, event, payload) {
  if (deps.panelWindow && !deps.panelWindow.isDestroyed()) {
    deps.panelWindow.webContents.send(event, payload);
  }
}

async function runCodeAgentSession({
  workspacePath,
  goal,
  settings = {},
  signal,
  deps = {},
}) {
  const resolvedPath = String(workspacePath || "").trim();
  if (!resolvedPath || !fs.existsSync(resolvedPath)) {
    return { ok: false, error: "Workspace path is invalid." };
  }

  const sessionId = crypto.randomUUID();
  let session = createEmptySession(goal, sessionId);
  writeSession(resolvedPath, session);

  const maxIterations = Number(settings.codeAgentMaxIterations) > 0
    ? Number(settings.codeAgentMaxIterations)
    : 15;

  try {
    await buildCodeIndex(resolvedPath).catch(() => {});
    const { contextText } = retrieveContext(resolvedPath, goal, settings);

    const planResult = await invokeStructuredChain({
      settings,
      systemPrompt: CODE_AGENT_SYSTEM_RULES,
      template: PLAN_TEMPLATE,
      operationName: "code-agent-plan",
      input: { goal, context: contextText || "(no index yet)" },
      schema: CodeAgentPlanSchema,
      signal,
    });
    session.plan = planResult?.value || planResult;
    writeSession(resolvedPath, session);
    emit(deps, "code-agent-step-updated", { sessionId, phase: "plan", plan: session.plan });

    while (session.iteration < maxIterations) {
      if (signal?.aborted) {
        session.status = "cancelled";
        writeSession(resolvedPath, session);
        return { ok: false, error: "Cancelled.", session };
      }

      session.iteration += 1;
      const toolLogText = (session.toolLog || []).slice(-6).map((e) => JSON.stringify(e)).join("\n");

      const actResult = await invokeStructuredChain({
        settings,
        systemPrompt: CODE_AGENT_SYSTEM_RULES,
        template: ACT_TEMPLATE,
        operationName: "code-agent-act",
        input: {
          goal,
          plan: JSON.stringify(session.plan),
          toolLog: toolLogText || "(none)",
          iteration: String(session.iteration),
          maxIterations: String(maxIterations),
        },
        schema: CodeAgentActSchema,
        signal,
      });

      const act = actResult?.value || actResult;
      if (act?.action === "finish") {
        session.status = "complete";
        session.active = false;
        session.summary = act.finishSummary || act.message || "Done.";
        writeSession(resolvedPath, session);
        emit(deps, "code-agent-complete", { sessionId, summary: session.summary });
        return { ok: true, session };
      }

      if (act?.action === "tool" && act.tool) {
        const toolResult = await executeCodeTool(resolvedPath, act.tool, act.args || {}, {
          confirmed: act.tool !== "run_terminal",
        });

        session.toolLog.push({ tool: act.tool, args: act.args, result: toolResult, at: new Date().toISOString() });

        if (toolResult.needsApproval) {
          session.pendingChange = { ...toolResult, tool: act.tool };
          writeSession(resolvedPath, session);
          emit(deps, "code-agent-diff-pending", {
            sessionId,
            path: toolResult.path,
            diff: toolResult.diff,
          });

          if (needsApprovalForChange(settings, toolResult)) {
            const approved = await waitForApproval(sessionId);
            if (!approved) {
              session.status = "rejected";
              session.pendingChange = null;
              writeSession(resolvedPath, session);
              return { ok: false, error: "Change rejected by user.", session };
            }
          }
          applyPendingChange(resolvedPath, session.pendingChange);
          session.touchedFiles.push(toolResult.path);
          session.pendingChange = null;
        }

        writeSession(resolvedPath, session);
        emit(deps, "code-agent-step-updated", {
          sessionId,
          phase: "tool",
          tool: act.tool,
          message: act.message,
        });
      }
    }

    session.status = "max_iterations";
    writeSession(resolvedPath, session);
    return { ok: false, error: "Max iterations reached.", session };
  } catch (error) {
    if (error instanceof BudgetExceededError || error?.name === "BudgetExceededError") {
      session.status = "budget_exceeded";
      writeSession(resolvedPath, session);
      emit(deps, "code-agent-error", { sessionId, error: error.message });
      return { ok: false, error: error.message, session };
    }
    session.status = "error";
    writeSession(resolvedPath, session);
    emit(deps, "code-agent-error", { sessionId, error: error?.message || String(error) });
    return { ok: false, error: error?.message || String(error), session };
  }
}

async function runPhaseNativeCodeAgent({
  workspacePath,
  phaseGoal,
  settings = {},
  signal,
  deps = {},
}) {
  return runCodeAgentSession({
    workspacePath,
    goal: phaseGoal,
    settings,
    signal,
    deps,
  });
}

function getCodeAgentStatus(workspacePath) {
  const session = readSession(workspacePath);
  if (!session) {
    return { ok: true, active: false };
  }
  return { ok: true, active: session.active && session.status === "running", session };
}

function cancelCodeAgentSession(workspacePath) {
  const session = readSession(workspacePath);
  if (session) {
    session.active = false;
    session.status = "cancelled";
    writeSession(workspacePath, session);
  }
  clearSession(workspacePath);
  return { ok: true };
}

async function summarizeCodeAgentSession(workspacePath, session, settings, signal) {
  const summary = await streamAIResponse({
    text: `Summarize this code agent session in Turkish (3 bullets):\nGoal: ${session.goal}\nFiles: ${(session.touchedFiles || []).join(", ")}\nLog: ${JSON.stringify((session.toolLog || []).slice(-5))}`,
    settings,
    signal,
    operation: "code-agent-summarize",
    complexityHint: "low",
  });
  return summary;
}

module.exports = {
  runCodeAgentSession,
  runPhaseNativeCodeAgent,
  getCodeAgentStatus,
  cancelCodeAgentSession,
  resolveApproval,
  waitForApproval,
  pendingApprovals,
};
