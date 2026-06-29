import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPromptFromHandoff,
  resolveHandoffAction,
  mapUserSelection,
  HANDOFF_REPLACE_LABEL,
  HANDOFF_REJECT_LABEL,
} from "../handoff/handleIncomingHandoff.ts";
import { isPendingHandoffFileName } from "../handoff/discovery.ts";

test("resolveHandoffAction waits when active task exists", () => {
  assert.equal(resolveHandoffAction(true, true), "waitForUser");
  assert.equal(resolveHandoffAction(true, true, "reject"), "reject");
  assert.equal(resolveHandoffAction(true, true, "startReplace"), "startNewTask");
});

test("resolveHandoffAction starts immediately without active task", () => {
  assert.equal(resolveHandoffAction(false, true), "startNewTask");
  assert.equal(resolveHandoffAction(false, false), "addToInput");
});

test("mapUserSelection maps Turkish labels", () => {
  assert.equal(mapUserSelection(HANDOFF_REPLACE_LABEL), "startReplace");
  assert.equal(mapUserSelection(HANDOFF_REJECT_LABEL), "reject");
  assert.equal(mapUserSelection(undefined), undefined);
});

test("buildPromptFromHandoff includes summary", () => {
  const prompt = buildPromptFromHandoff({ taskSummary: "Implement login" });
  assert.match(prompt, /Implement login/);
  assert.match(prompt, /Sauron Core handoff/);
});

test("isPendingHandoffFileName supports legacy and id files", () => {
  assert.equal(isPendingHandoffFileName("handoff.json"), true);
  assert.equal(isPendingHandoffFileName("handoff-2026.json"), true);
  assert.equal(isPendingHandoffFileName("handoff-2026.json.consumed"), false);
});
