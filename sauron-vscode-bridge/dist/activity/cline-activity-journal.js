"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_LINES = exports.ACTIVITY_FILENAME = void 0;
exports.buildPlanFromHandoff = buildPlanFromHandoff;
exports.appendClineActivityEvent = appendClineActivityEvent;
exports.journalHandoffPlan = journalHandoffPlan;
exports.journalHandoffActivityStart = journalHandoffActivityStart;
exports.journalHandoffQuestion = journalHandoffQuestion;
exports.journalTaskActivity = journalTaskActivity;
exports.journalTaskReport = journalTaskReport;
const crypto_1 = __importDefault(require("crypto"));
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
exports.ACTIVITY_FILENAME = "cline-activity.jsonl";
exports.MAX_LINES = 200;
const MAX_JOURNAL_LINES = exports.MAX_LINES;
function basenameOnly(filePath) {
    const parts = String(filePath || "").split(/[/\\]/);
    return parts[parts.length - 1] || filePath;
}
function makeId(prefix, seed) {
    const hash = crypto_1.default.createHash("sha1").update(seed).digest("hex").slice(0, 12);
    return `${prefix}-${hash}`;
}
function buildPlanFromHandoff(handoff) {
    const goal = String(handoff.goal || handoff.taskSummary || "").trim();
    if (!goal) {
        return { title: "Cline görevi", body: "" };
    }
    const steps = [];
    let stepIndex = 1;
    if (handoff.relevantFiles?.length) {
        const files = handoff.relevantFiles.slice(0, 4).map(basenameOnly).join(", ");
        steps.push(`${stepIndex}. İlgili dosyaları incele (${files})`);
        stepIndex += 1;
    }
    if (handoff.pipelineId && handoff.pipelinePhase) {
        const total = handoff.pipelineTotalPhases ? ` / ${handoff.pipelineTotalPhases}` : "";
        const label = handoff.pipelineLabel || handoff.pipelineId;
        steps.push(`${stepIndex}. Üretim hattı faz ${handoff.pipelinePhase}${total} — ${label}`);
        stepIndex += 1;
    }
    else if (handoff.projectType) {
        steps.push(`${stepIndex}. Proje türü: ${handoff.projectType}`);
        stepIndex += 1;
    }
    if (handoff.batchScope?.length) {
        const scope = handoff.batchScope.slice(0, 4).join(", ");
        steps.push(`${stepIndex}. Kapsam: ${scope}`);
        stepIndex += 1;
    }
    if (handoff.verification?.command) {
        steps.push(`${stepIndex}. Bitince doğrula: ${handoff.verification.command}`);
    }
    else {
        steps.push(`${stepIndex}. Görevi tamamla ve sonucu raporla`);
    }
    const body = [`Hedef: ${goal}`, "", "Adımlar:", ...steps].join("\n");
    return {
        title: goal.length > 72 ? `${goal.slice(0, 69)}…` : goal,
        body,
    };
}
async function appendClineActivityEvent(workspaceRoot, event) {
    const journalPath = path_1.default.join(workspaceRoot, ".sauron", exports.ACTIVITY_FILENAME);
    await promises_1.default.mkdir(path_1.default.dirname(journalPath), { recursive: true });
    const fullEvent = {
        id: event.id || makeId(event.kind, `${event.title}:${event.body}:${Date.now()}`),
        kind: event.kind,
        title: event.title,
        body: event.body,
        at: event.at || new Date().toISOString(),
        scopeKey: event.scopeKey,
        handoffId: event.handoffId,
    };
    let existing = "";
    try {
        existing = await promises_1.default.readFile(journalPath, "utf8");
    }
    catch {
        // journal may not exist yet
    }
    const lines = `${existing}${JSON.stringify(fullEvent)}\n`.split(/\r?\n/).filter(Boolean);
    const pruned = lines.length > MAX_JOURNAL_LINES ? lines.slice(lines.length - MAX_JOURNAL_LINES) : lines;
    await promises_1.default.writeFile(journalPath, `${pruned.join("\n")}\n`, "utf8");
    return fullEvent;
}
async function journalHandoffPlan(workspaceRoot, handoff) {
    const plan = buildPlanFromHandoff(handoff);
    if (!plan.body) {
        return;
    }
    await appendClineActivityEvent(workspaceRoot, {
        kind: "plan",
        title: plan.title,
        body: plan.body,
        scopeKey: handoff.id || "",
        handoffId: handoff.id,
        id: makeId("plan", `${handoff.id || plan.title}`),
    });
}
async function journalHandoffActivityStart(workspaceRoot, handoff) {
    await appendClineActivityEvent(workspaceRoot, {
        kind: "activity",
        title: "Cline göreve başladı",
        body: handoff.goal || handoff.taskSummary || "Görev işleniyor",
        scopeKey: handoff.id || "active",
        handoffId: handoff.id,
        id: makeId("activity-start", `${handoff.id || ""}:${Date.now()}`),
    });
}
async function journalHandoffQuestion(workspaceRoot, handoffId, body) {
    await appendClineActivityEvent(workspaceRoot, {
        kind: "question",
        title: "Karar gerekli",
        body,
        scopeKey: handoffId,
        handoffId,
        id: makeId("question", `${handoffId}:${body}`),
    });
}
async function journalTaskActivity(workspaceRoot, metrics, scopeKey) {
    await appendClineActivityEvent(workspaceRoot, {
        kind: "activity",
        title: "Cline çalışıyor",
        body: `Model: ${metrics.modelId || "bilinmiyor"} · token: ${metrics.tokensIn + metrics.tokensOut}`,
        scopeKey,
        id: makeId("activity", `${scopeKey}:${metrics.tokensIn}:${metrics.tokensOut}`),
    });
}
async function journalTaskReport(workspaceRoot, summary, handoffId) {
    await appendClineActivityEvent(workspaceRoot, {
        kind: "report",
        title: "Görev tamamlandı",
        body: summary || "Cline görevi bitti.",
        scopeKey: handoffId || "complete",
        handoffId,
        id: makeId("report", `${handoffId || ""}:${summary}`),
    });
}
//# sourceMappingURL=cline-activity-journal.js.map