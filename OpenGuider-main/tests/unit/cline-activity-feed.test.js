const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  appendActivityEvent,
  getClineActivityFeed,
  readActivityEvents,
} = require("../../src/sauron/cline-activity/cline-activity-feed");
const { writeHandoff, buildHandoffPayload } = require("../../src/sauron/handoff");

test("readActivityEvents returns events after cursor id", () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "cline-feed-"));
  try {
    const first = appendActivityEvent(workspace, {
      id: "evt-1",
      kind: "plan",
      title: "Plan",
      body: "Adım 1",
    });
    appendActivityEvent(workspace, {
      id: "evt-2",
      kind: "activity",
      title: "Çalışıyor",
      body: "Token: 10",
      scopeKey: "active",
    });

    const all = readActivityEvents(workspace, { limit: 10 });
    assert.equal(all.length, 2);
    assert.equal(all[0].id, first.id);

    const afterFirst = readActivityEvents(workspace, { afterId: "evt-1", limit: 10 });
    assert.equal(afterFirst.length, 1);
    assert.equal(afterFirst[0].id, "evt-2");
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("getClineActivityFeed derives plan from pending handoff", () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "cline-derived-"));
  try {
    const payload = buildHandoffPayload({ goalIntent: "Test görev planı" }, workspace);
    writeHandoff(workspace, payload);

    const feed = getClineActivityFeed(workspace, { limit: 10 });
    assert.equal(feed.ok, true);
    const planEvent = feed.events.find((event) => event.kind === "plan");
    assert.ok(planEvent);
    assert.match(planEvent.body, /Hedef:/);
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});
