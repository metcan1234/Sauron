const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  generateHandoffId,
  listPendingHandoffs,
  rejectPendingHandoffs,
  getHandoffStatus,
  writeHandoff,
  buildHandoffPayload,
  buildTaskSummary,
  seedSauronRules,
  isPendingHandoffFileName,
} = require("../../src/sauron/handoff");

test("generateHandoffId returns unique values", () => {
  const a = generateHandoffId();
  const b = generateHandoffId();
  assert.notEqual(a, b);
  assert.match(a, /^[\d-T]+z-/i);
});

test("isPendingHandoffFileName filters terminal artifacts", () => {
  assert.equal(isPendingHandoffFileName("handoff-abc.json"), true);
  assert.equal(isPendingHandoffFileName("handoff.json"), true);
  assert.equal(isPendingHandoffFileName("handoff-abc.json.consumed"), false);
  assert.equal(isPendingHandoffFileName("handoff-abc.json.rejected"), false);
});

test("writeHandoff creates id-based file and payload id", () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "sauron-handoff-"));
  try {
    const payload = buildHandoffPayload({ goalIntent: "test goal" }, workspace);
    const written = writeHandoff(workspace, payload);
    assert.match(written.fileName, /^handoff-.+\.json$/);
    assert.ok(fs.existsSync(written.handoffPath));

    const saved = JSON.parse(fs.readFileSync(written.handoffPath, "utf8"));
    assert.equal(saved.id, written.handoffId);
    assert.equal(saved.version, 2);
    assert.match(saved.taskSummary, /test goal/);
    assert.ok(saved.complexityHint);
    assert.ok(saved.costContext);
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("buildTaskSummary excludes transcript by default", () => {
  const summary = buildTaskSummary({
    goalIntent: "fix bug",
    messages: [{ role: "user", content: "long transcript should not appear" }],
    activePlan: { goal: "Ship fix", steps: [{ title: "Write test", status: "pending" }] },
  });

  assert.match(summary, /Goal: Ship fix/);
  assert.match(summary, /Plan steps:/);
  assert.doesNotMatch(summary, /Recent conversation/);
});

test("buildTaskSummary includes compact latest chat context by default", () => {
  const summary = buildTaskSummary({
    goalIntent: "fix bug",
    messages: [
      { role: "user", content: "login sayfasini duzelt" },
      { role: "assistant", content: "Tamam, once auth modulune bakalim." },
    ],
  });

  assert.match(summary, /Latest chat context/);
  assert.match(summary, /login sayfasini duzelt/);
  assert.match(summary, /auth modulune bakalim/);
  assert.doesNotMatch(summary, /Recent conversation/);
});

test("buildTaskSummary includes chat session title when provided", () => {
  const summary = buildTaskSummary({
    chatSessionTitle: "Auth refactor",
    messages: [{ role: "user", content: "login sayfasini duzelt" }],
  });

  assert.match(summary, /Chat session: Auth refactor/);
});

test("buildTaskSummary includes transcript when enabled", () => {
  const summary = buildTaskSummary(
    {
      goalIntent: "fix bug",
      messages: [{ role: "user", content: "include me" }],
    },
    { includeTranscript: true },
  );

  assert.match(summary, /Recent conversation/);
  assert.match(summary, /include me/);
});

test("buildTaskSummary respects handoffMaxChars while preserving goal", () => {
  const summary = buildTaskSummary(
    {
      activePlan: {
        goal: "Important goal",
        steps: [{ title: "Step one", status: "pending" }],
      },
      goalIntent: "x".repeat(5000),
    },
    { handoffMaxChars: 200 },
  );

  assert.match(summary, /Goal: Important goal/);
  assert.ok(summary.length <= 200);
});

test("buildHandoffPayload assigns complexityHint for complex tasks", () => {
  const payload = buildHandoffPayload(
    {
      activePlan: {
        goal: "Full architecture refactor across modules",
        steps: [{ title: "Migrate services", status: "pending" }],
      },
    },
    "/tmp/workspace",
    undefined,
    {
      finopsCostOptimizerEnabled: true,
      geminiApiKey: "gemini-key",
      deepseekApiKey: "deepseek-key",
      openaiApiKey: "openai-key",
    },
  );

  assert.equal(payload.complexityHint, "high");
  assert.ok(payload.costContext?.suggestedClineAgent);
  assert.equal(payload.costContext.suggestedClineAgent.providerId, "openai");
});

test("seedSauronRules does not overwrite existing rules file", () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "sauron-rules-"));
  try {
    const rulesDir = path.join(workspace, ".clinerules");
    fs.mkdirSync(rulesDir, { recursive: true });
    const rulesPath = path.join(rulesDir, "sauron-workspace.md");
    fs.writeFileSync(rulesPath, "custom rules", "utf8");
    const mtimeBefore = fs.statSync(rulesPath).mtimeMs;

    const result = seedSauronRules(workspace);
    assert.equal(result.seeded, false);
    assert.equal(fs.readFileSync(rulesPath, "utf8"), "custom rules");
    assert.equal(fs.statSync(rulesPath).mtimeMs, mtimeBefore);
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("listPendingHandoffs ignores consumed and rejected files", () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "sauron-handoff-"));
  try {
    const sauronDir = path.join(workspace, ".sauron");
    fs.mkdirSync(sauronDir, { recursive: true });
    fs.writeFileSync(path.join(sauronDir, "handoff-old.json"), "{}");
    fs.writeFileSync(path.join(sauronDir, "handoff-old.json.consumed"), "{}");
    fs.writeFileSync(path.join(sauronDir, "handoff-old.json.rejected"), "{}");
    fs.writeFileSync(path.join(sauronDir, "handoff.json"), JSON.stringify({ createdAt: "2020-01-01T00:00:00.000Z" }));

    const pending = listPendingHandoffs(workspace);
    assert.equal(pending.length, 2);
    assert.ok(pending.some((item) => item.fileName === "handoff-old.json"));
    assert.ok(pending.some((item) => item.fileName === "handoff.json"));
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("rejectPendingHandoffs marks pending files as rejected", () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "sauron-handoff-"));
  try {
    const sauronDir = path.join(workspace, ".sauron");
    fs.mkdirSync(sauronDir, { recursive: true });
    const pendingPath = path.join(sauronDir, "handoff-pending.json");
    fs.writeFileSync(pendingPath, JSON.stringify({ createdAt: "2020-01-01T00:00:00.000Z" }));

    const rejectedCount = rejectPendingHandoffs(workspace);
    assert.equal(rejectedCount, 1);
    assert.equal(fs.existsSync(pendingPath), false);
    assert.equal(fs.existsSync(`${pendingPath}.rejected`), true);
    assert.equal(listPendingHandoffs(workspace).length, 0);
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("getHandoffStatus tracks pending consumed and rejected states", () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "sauron-handoff-status-"));
  try {
    const fileName = "handoff-test.json";
    const sauronDir = path.join(workspace, ".sauron");
    fs.mkdirSync(sauronDir, { recursive: true });
    const pendingPath = path.join(sauronDir, fileName);
    fs.writeFileSync(pendingPath, "{}");

    assert.equal(getHandoffStatus(workspace, fileName).status, "pending");

    fs.renameSync(pendingPath, `${pendingPath}.consumed`);
    assert.equal(getHandoffStatus(workspace, fileName).status, "consumed");

    fs.renameSync(`${pendingPath}.consumed`, `${pendingPath}.rejected`);
    assert.equal(getHandoffStatus(workspace, fileName).status, "rejected");
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("getHandoffStatus tracks pending consumed and rejected states", () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "sauron-handoff-status-"));
  try {
    const fileName = "handoff-test.json";
    const sauronDir = path.join(workspace, ".sauron");
    fs.mkdirSync(sauronDir, { recursive: true });
    const pendingPath = path.join(sauronDir, fileName);
    fs.writeFileSync(pendingPath, "{}");

    assert.equal(getHandoffStatus(workspace, fileName).status, "pending");

    fs.renameSync(pendingPath, `${pendingPath}.consumed`);
    assert.equal(getHandoffStatus(workspace, fileName).status, "consumed");

    fs.renameSync(`${pendingPath}.consumed`, `${pendingPath}.rejected`);
    assert.equal(getHandoffStatus(workspace, fileName).status, "rejected");
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});
