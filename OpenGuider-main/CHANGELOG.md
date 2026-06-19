# Changelog

## 1.2.0 — 2026-06-19

### Added
- **Web Studio:** Panel wizard for corporate website brief (brand, pages, colors)
- Next.js 14 + Tailwind corporate template (`templates/corporate-nextjs/`)
- Scaffold IPC: save/load brief, scaffold project, preview localhost:3000
- Web intent detection (build vs browse) — prevents misrouting to browser plugin
- Handoff payload: `webBrief`, `projectType: corporate-web`, quality gates
- `.clinerules/sauron-web-dev.md` and `.sauron/web-quality-checklist.md` on scaffold
- Docs: `web-studio-tr.md`, `web-deploy-tr.md`, ADR-0006

### Tests
- web-intent, web-brief-schema, scaffold-nextjs, web-handoff-payload, web-quality-checklist

## 1.1.0 — 2026-06-19

### Added
- Sauron doctor: workspace/Bridge/Cline prerequisite checks in Settings
- Browser plugin FinOps: token usage from Python sidecar recorded as `browser-goal`
- Handoff history panel with pending badge, reject action, and 30s refresh
- FinOps hard budget mode, analytics time series, and settings chart
- ADR documents (0001–0005) and `sauron-monorepo-test` CI workflow
- `install-sauron-stack.ps1` documented in README; OpenRouter max tokens in advanced settings
- Extracted `src/main/window-manager.js` and `src/main/tray-menu.js`

### Changed
- `prepareLlmCall` throws `BudgetExceededError` when hard budget exhausted
- Settings UI: Turkish i18n keys, FinOps optimizer tier/mode selects visible

### Tests
- Added unit/integration coverage for browser FinOps, handoff history, hard budget, analytics

## 1.0.0 — 2026-06-19

### Added
- Message edit/delete with branch truncation and auto-regenerate
- Chat folders (create, move sessions)
- Drag-drop / paste attachments (max 5 files, 5MB)
- Artifact side panel for code blocks
- Settings: system prompt override and user memory facts
- Local chat backup/export/import JSON
- FinOps session vs total spend badge
- Turkish i18n for panel onboarding and errors
- Ctrl+K chat history shortcut
- Plan action bar when `waiting_user` with active plan (no browser task)

### Changed
- IPC modularized into `src/ipc/` (chat-sessions, ai, workspace, finops, browser)
- Panel and Settings renderer crash recovery

### Tests
- 117 automated tests (session edit/delete, folder CRUD, plan bar visibility)

## 0.3.5 and earlier

See git history for prior MVP and FinOps/agent-matrix releases.
