import assert from "node:assert/strict"
import test from "node:test"
import { isWorkspaceFolderOpen, pathsEqual } from "../handoff/workspace-path.ts"

test("pathsEqual compares Windows paths case-insensitively", () => {
	assert.equal(pathsEqual("C:\\Work\\Demo", "c:\\work\\demo"), true)
	assert.equal(pathsEqual("/tmp/a", "/tmp/b"), false)
})

test("isWorkspaceFolderOpen matches configured workspace root", () => {
	const folders = [{ uri: { fsPath: "C:\\Users\\Can\\OneDrive\\Desktop\\denemeler" } }] as const
	assert.equal(
		isWorkspaceFolderOpen("C:\\Users\\Can\\OneDrive\\Desktop\\denemeler", folders as never),
		true,
	)
	assert.equal(
		isWorkspaceFolderOpen("C:\\Users\\Can\\Desktop", folders as never),
		false,
	)
})
