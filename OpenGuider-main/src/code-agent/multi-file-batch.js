const { applyPendingChange } = require("./code-tools");

async function applyBatchChanges({
  workspacePath,
  changes = [],
  settings = {},
  needsApprovalForChange,
  waitForApproval,
  emit,
  sessionId,
}) {
  const applied = [];
  const skipped = [];
  for (const change of changes) {
    if (!change?.path) {
      skipped.push({ change, reason: "invalid" });
      continue;
    }
    if (typeof needsApprovalForChange === "function" && needsApprovalForChange(settings, change)) {
      if (typeof emit === "function") {
        emit("code-agent-diff-pending", {
          sessionId,
          path: change.path,
          diff: change.diff || "",
        });
      }
      if (typeof waitForApproval === "function") {
        const approved = await waitForApproval(sessionId);
        if (!approved) {
          skipped.push({ change, reason: "rejected" });
          break;
        }
      }
    }
    const result = applyPendingChange(workspacePath, change);
    if (result?.ok) {
      applied.push(change.path);
    } else {
      skipped.push({ change, reason: result?.error || "apply-failed" });
    }
  }
  return { ok: skipped.length === 0, applied, skipped };
}

module.exports = { applyBatchChanges };
