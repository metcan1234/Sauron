# Changelog

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
