import assert from "node:assert/strict"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import {
	appendClineActivityEvent,
	buildPlanFromHandoff,
	MAX_LINES,
} from "../activity/cline-activity-journal.ts"

test("buildPlanFromHandoff includes verification step", () => {
	const plan = buildPlanFromHandoff({
		goal: "Bridge test",
		verification: { command: "npm test" },
	})
	assert.match(plan.body, /npm test/)
})

test("appendClineActivityEvent prunes journal lines", async () => {
	const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "bridge-journal-"))
	try {
		for (let index = 0; index < MAX_LINES + 5; index += 1) {
			await appendClineActivityEvent(workspace, {
				kind: "activity",
				title: `Event ${index}`,
				body: `Body ${index}`,
				id: `evt-${index}`,
			})
		}

		const journalPath = path.join(workspace, ".sauron", "cline-activity.jsonl")
		const raw = await fs.readFile(journalPath, "utf8")
		const lines = raw.split(/\r?\n/).filter(Boolean)
		assert.equal(lines.length, MAX_LINES)
		assert.match(lines[0], /Event 5/)
	} finally {
		await fs.rm(workspace, { recursive: true, force: true })
	}
})
