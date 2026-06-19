# Cline fork patches for Sauron

This fork keeps Sauron-specific changes isolated to the public extension API. Handoff loading lives in the separate [`sauron-vscode-bridge`](../sauron-vscode-bridge/) extension.

## Modified upstream files

| File | Change |
|------|--------|
| [`apps/vscode/src/exports/cline.d.ts`](apps/vscode/src/exports/cline.d.ts) | Added `hasActiveTask()`, `addToInput()`, `ActiveTaskMetrics`, `getActiveTaskMetrics()`, `getActiveModel()`, `setActiveModel()` |
| [`apps/vscode/src/exports/index.ts`](apps/vscode/src/exports/index.ts) | Implemented the methods above; metrics reuse `getApiMetrics()`; model switching updates act-mode API configuration |

## Removed Phase 1 hooks (no longer needed)

These files were reverted to upstream behavior:

- `apps/vscode/src/services/sauron/HandoffLoader.ts` — deleted
- `apps/vscode/src/hosts/vscode/VscodeWebviewProvider.ts` — removed `consumeSauronHandoff` call
- `apps/vscode/src/common.ts` — removed `openSidebarForPendingHandoff`
- `apps/vscode/package.json` — removed `workspaceContains:.sauron/handoff.json` activation event

## Re-applying after upstream Cline update

1. Fetch upstream Cline release/tag into `cline-main/`.
2. Re-apply the two export files using this patch list (or a 3-way merge).
3. Confirm no Sauron handoff hooks were reintroduced in `VscodeWebviewProvider` / `common.ts`.
4. Run:

```bash
cd apps/vscode
npm install
npm run compile
```

5. Rebuild and test the bridge:

```bash
cd ../../sauron-vscode-bridge
npm install
npm run compile
npm test
```

## Expected diff size

About 90 lines across two files in `apps/vscode/src/exports/` (handoff API + FinOps metrics + agent model routing).
