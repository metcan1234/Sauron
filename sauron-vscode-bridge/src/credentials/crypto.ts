import * as crypto from "crypto"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"

const SYNC_KEY_DIR = path.join(os.homedir(), ".sauron")
const SYNC_KEY_FILE = path.join(SYNC_KEY_DIR, "cline-sync.key")
export const REQUEST_FILENAME = "cline-credential-request.json"

export interface ClineCredentialPayload {
	geminiApiKey?: string
	deepSeekApiKey?: string
	openAiApiKey?: string
	ollamaBaseUrl?: string
}

export interface CredentialRequestMeta {
	version: number
	nonce: string
	tempPath: string
	expiresAt: string
	configuredProviders: string[]
	createdAt: string
}

function getOrCreateSyncKey(): Buffer {
	if (fs.existsSync(SYNC_KEY_FILE)) {
		const existing = fs.readFileSync(SYNC_KEY_FILE)
		if (existing.length >= 32) {
			return existing.subarray(0, 32)
		}
	}
	fs.mkdirSync(SYNC_KEY_DIR, { recursive: true })
	const key = crypto.randomBytes(32)
	fs.writeFileSync(SYNC_KEY_FILE, key, { mode: 0o600 })
	return key
}

export function decryptPayloadBuffer(buffer: Buffer): ClineCredentialPayload | null {
	if (!Buffer.isBuffer(buffer) || buffer.length < 28) {
		return null
	}
	try {
		const key = getOrCreateSyncKey()
		const iv = buffer.subarray(0, 12)
		const tag = buffer.subarray(12, 28)
		const encrypted = buffer.subarray(28)
		const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv)
		decipher.setAuthTag(tag)
		const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])
		return JSON.parse(decrypted.toString("utf8")) as ClineCredentialPayload
	} catch {
		return null
	}
}

export function readCredentialRequest(workspacePath: string): CredentialRequestMeta | null {
	const requestPath = path.join(workspacePath, ".sauron", REQUEST_FILENAME)
	if (!fs.existsSync(requestPath)) {
		return null
	}
	try {
		return JSON.parse(fs.readFileSync(requestPath, "utf8")) as CredentialRequestMeta
	} catch {
		return null
	}
}

export function cleanupCredentialArtifacts(workspacePath: string, tempPath?: string): void {
	const requestPath = path.join(workspacePath, ".sauron", REQUEST_FILENAME)
	try {
		if (tempPath && fs.existsSync(tempPath)) {
			fs.unlinkSync(tempPath)
		}
	} catch {
		// ignore
	}
	try {
		if (fs.existsSync(requestPath)) {
			fs.unlinkSync(requestPath)
		}
	} catch {
		// ignore
	}
}

export async function applyCredentialsFromWorkspace(
	workspacePath: string,
	cline: {
		syncProviderCredentials?: (payload: ClineCredentialPayload) => Promise<{ synced?: string[] }>
	},
): Promise<{ ok: boolean; synced: string[]; error?: string }> {
	if (typeof cline.syncProviderCredentials !== "function") {
		return { ok: false, synced: [], error: "Cline fork does not support credential sync." }
	}

	const request = readCredentialRequest(workspacePath)
	if (!request?.tempPath) {
		return { ok: false, synced: [], error: "No pending credential request in workspace." }
	}

	if (request.expiresAt && Date.parse(request.expiresAt) < Date.now()) {
		cleanupCredentialArtifacts(workspacePath, request.tempPath)
		return { ok: false, synced: [], error: "Credential request expired." }
	}

	const payload = decryptPayloadBuffer(fs.readFileSync(request.tempPath))
	if (!payload || Object.keys(payload).length === 0) {
		cleanupCredentialArtifacts(workspacePath, request.tempPath)
		return { ok: false, synced: [], error: "Credential payload could not be decrypted." }
	}

	try {
		const result = await cline.syncProviderCredentials(payload)
		cleanupCredentialArtifacts(workspacePath, request.tempPath)
		return { ok: true, synced: result?.synced || [] }
	} catch (error) {
		return {
			ok: false,
			synced: [],
			error: error instanceof Error ? error.message : "Credential sync failed.",
		}
	}
}
