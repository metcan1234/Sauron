import assert from "node:assert/strict"
import * as crypto from "node:crypto"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import test from "node:test"
import {
	REQUEST_FILENAME,
	applyCredentialsFromWorkspace,
	decryptPayloadBuffer,
} from "../credentials/crypto.ts"
import { probeCredentialSyncCapability } from "../credentials/sync.ts"

const SYNC_KEY_FILE = path.join(os.homedir(), ".sauron", "cline-sync.key")

function getOrCreateSyncKey(): Buffer {
	if (fs.existsSync(SYNC_KEY_FILE)) {
		const existing = fs.readFileSync(SYNC_KEY_FILE)
		if (existing.length >= 32) {
			return existing.subarray(0, 32)
		}
	}
	fs.mkdirSync(path.dirname(SYNC_KEY_FILE), { recursive: true })
	const key = crypto.randomBytes(32)
	fs.writeFileSync(SYNC_KEY_FILE, key, { mode: 0o600 })
	return key
}

function encryptPayloadObject(payload: Record<string, string>): Buffer {
	const key = getOrCreateSyncKey()
	const iv = crypto.randomBytes(12)
	const cipher = crypto.createCipheriv("aes-256-gcm", key, iv)
	const encrypted = Buffer.concat([
		cipher.update(JSON.stringify(payload), "utf8"),
		cipher.final(),
	])
	const tag = cipher.getAuthTag()
	return Buffer.concat([iv, tag, encrypted])
}

test("probeCredentialSyncCapability detects fork API", () => {
	assert.equal(probeCredentialSyncCapability({}), false)
	assert.equal(
		probeCredentialSyncCapability({
			syncProviderCredentials: async () => ({ synced: [] }),
		}),
		true,
	)
})

test("applyCredentialsFromWorkspace calls syncProviderCredentials and cleans up", async () => {
	const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "bridge-cred-"))
	const sauronDir = path.join(workspace, ".sauron")
	fs.mkdirSync(sauronDir, { recursive: true })

	const tempPath = path.join(os.tmpdir(), `sauron-cline-creds-${crypto.randomUUID()}.enc`)
	const payload = { geminiApiKey: "g-test", deepSeekApiKey: "d-test" }
	fs.writeFileSync(tempPath, encryptPayloadObject(payload), { mode: 0o600 })
	fs.writeFileSync(
		path.join(sauronDir, REQUEST_FILENAME),
		JSON.stringify({
			version: 1,
			nonce: "test-nonce",
			tempPath,
			expiresAt: new Date(Date.now() + 60_000).toISOString(),
			configuredProviders: ["gemini", "deepseek"],
			createdAt: new Date().toISOString(),
		}),
	)

	let received: Record<string, string> | null = null
	const result = await applyCredentialsFromWorkspace(workspace, {
		syncProviderCredentials: async (creds) => {
			received = creds as Record<string, string>
			return { synced: ["gemini", "deepseek"] }
		},
	})

	assert.equal(result.ok, true)
	assert.deepEqual(result.synced, ["gemini", "deepseek"])
	assert.equal(received?.geminiApiKey, "g-test")
	assert.equal(received?.deepSeekApiKey, "d-test")
	assert.equal(fs.existsSync(tempPath), false)
	assert.equal(fs.existsSync(path.join(sauronDir, REQUEST_FILENAME)), false)
})

test("applyCredentialsFromWorkspace rejects marketplace Cline without sync API", async () => {
	const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "bridge-cred-"))
	const result = await applyCredentialsFromWorkspace(workspace, {})
	assert.equal(result.ok, false)
	assert.match(result.error || "", /does not support credential sync/i)
})

test("decryptPayloadBuffer roundtrip matches OpenGuider sidecar format", () => {
	const encrypted = encryptPayloadObject({ openAiApiKey: "sk-roundtrip" })
	const decrypted = decryptPayloadBuffer(encrypted)
	assert.equal(decrypted?.openAiApiKey, "sk-roundtrip")
})
