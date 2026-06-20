import path from "path"

export function pathsEqual(left: string, right: string): boolean {
	const normalizedLeft = path.normalize(left)
	const normalizedRight = path.normalize(right)
	if (process.platform === "win32") {
		return normalizedLeft.toLowerCase() === normalizedRight.toLowerCase()
	}
	return normalizedLeft === normalizedRight
}

export function isWorkspaceFolderOpen(
	targetPath: string,
	workspaceFolders: readonly { uri: { fsPath: string } }[] | undefined,
): boolean {
	const target = path.resolve(targetPath)
	for (const folder of workspaceFolders ?? []) {
		if (pathsEqual(folder.uri.fsPath, target)) {
			return true
		}
	}
	return false
}
