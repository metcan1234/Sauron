const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { buildPlanFromHandoff } = require("../../src/sauron/cline-activity/plan-from-handoff");

test("buildPlanFromHandoff produces Turkish steps from handoff", () => {
  const plan = buildPlanFromHandoff({
    goal: "Kurumsal site ana sayfasını güncelle",
    pipelineId: "corporate-web-v3",
    pipelinePhase: 2,
    pipelineTotalPhases: 6,
    pipelineLabel: "Kurumsal site",
    relevantFiles: ["src/app/page.tsx", "lib/site-data.ts"],
    verification: { command: "npm run build" },
  });

  assert.match(plan.title, /Kurumsal site ana sayfasını güncelle/);
  assert.match(plan.body, /Hedef:/);
  assert.match(plan.body, /Adımlar:/);
  assert.match(plan.body, /page\.tsx/);
  assert.match(plan.body, /faz 2 \/ 6/);
  assert.match(plan.body, /npm run build/);
});

test("buildPlanFromHandoff returns empty body without goal", () => {
  const plan = buildPlanFromHandoff({});
  assert.equal(plan.body, "");
});
