import assert from "node:assert/strict"
import test from "node:test"
import type { ClineAPI } from "../cline.ts"
import {
	probeClineCapabilities,
	safeHasActiveTask,
} from "../cline-capabilities.ts"

test("probeClineCapabilities detects marketplace-style partial API", () => {
	const cline = {
		startNewTask: async () => {},
		sendMessage: async () => {},
		pressPrimaryButton: async () => {},
		hasActiveTask: () => false,
		addToInput: async () => {},
		pressSecondaryButton: async () => {},
	} satisfies ClineAPI

	const caps = probeClineCapabilities(cline)
	assert.equal(caps.canStartTask, true)
	assert.equal(caps.canAddToInput, true)
	assert.equal(caps.canDetectActiveTask, true)
	assert.equal(caps.canRouteModel, false)
	assert.equal(caps.canSyncCredentials, false)
})

test("probeClineCapabilities detects credential sync on fork API", () => {
	const cline = {
		startNewTask: async () => {},
		sendMessage: async () => {},
		pressPrimaryButton: async () => {},
		hasActiveTask: () => false,
		addToInput: async () => {},
		pressSecondaryButton: async () => {},
		syncProviderCredentials: async () => ({ synced: [] }),
	} satisfies ClineAPI

	const caps = probeClineCapabilities(cline)
	assert.equal(caps.canSyncCredentials, true)
})

test("safeHasActiveTask returns false when API missing", () => {
	const cline = {
		startNewTask: async () => {},
		sendMessage: async () => {},
		pressPrimaryButton: async () => {},
		addToInput: async () => {},
		pressSecondaryButton: async () => {},
	} as ClineAPI

	assert.equal(safeHasActiveTask(cline), false)
})
