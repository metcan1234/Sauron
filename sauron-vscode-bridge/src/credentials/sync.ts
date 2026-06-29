import type { ClineAPI } from "../cline"
import { applyCredentialsFromWorkspace } from "./crypto"

export function probeCredentialSyncCapability(cline: ClineAPI): boolean {
	return typeof cline.syncProviderCredentials === "function"
}

export async function syncCredentialsForWorkspace(
	workspacePath: string,
	cline: ClineAPI,
): Promise<{ ok: boolean; synced: string[]; error?: string }> {
	return applyCredentialsFromWorkspace(workspacePath, cline)
}
