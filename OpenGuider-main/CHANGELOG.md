# Changelog

## 1.4.2 — 2026-06-19

### Changed
- Uygulama adı **Sauron** olarak yeniden markalandı (`productName`, installer, kısayol, UI)
- `appId`: `com.sauron.desktop`; çıktı: `Sauron-{version}-win-x64.exe`
- Renderer birincil API: `window.sauron` (`window.openguider` alias korunur)
- Chat yedek dosyaları: `sauron-chats-*.json`; SecureStore service: `Sauron`

## 1.4.1 — 2026-06-19

### Fixed
- **Hayalet CMD pencereleri:** VS Code doğrudan `Code.exe` ile açılır; `cmd /c start` kaldırıldı
- Çift VS Code launch (pipeline + focus) tek çağrıya indirildi; 3 sn debounce
- Python browser sidecar: `windowsHide: true`
- Preload IPC: `pipeline-updated` kanalı allowlist'e eklendi (`channel-registry.js`)

### Added
- `vscode-launcher.js` — merkezi VS Code başlatıcı
- `app-paths.js` — paketlenmiş uygulama yolu çözümleme
- Bridge VSIX `extraResources` ile NSIS paketine gömülür
- `predist:win`, `scripts/pre-dist-check.js`, `scripts/build-windows-release.ps1`
- `waitForBridgeApi()` panel bootstrap race koruması
- `asarUnpack`: keytar, onnxruntime-node
- `afterPack` electron-builder hook bağlandı

### Tests
- `vscode-launcher.test.js`, `channel-registry.test.js`

## 1.4.0 — 2026-06-19

### Added
- **Cline Self-Build Engine:** Fazlı build pipeline (corporate-web, self-improve, bridge, monorepo)
- **Self-Build Studio:** Panel wizard (🔧) + pipeline başlatma
- Handoff genişletme: `projectType`, `pipelineId/Phase`, `autoChain`, `verification`
- ClineRules paketleri: electron-dev, bridge-dev, self-improve
- Cline fork API: `getTaskState`, `clearTask`, `getLastTaskSummary`
- Bridge: `cline-task-complete.json` artifact, handoff kuyruğu, prompt enrichment
- Proje-tipi FinOps bütçe profilleri
- IPC: `start-build-pipeline`, `advance-build-pipeline`, `run-workspace-command`, `detect-web-intent`
- Chat → Web Studio CTA; Üretim Hattı panel kartı

### Tests
- `build-pipeline.test.js`, `clinerules-packs.test.js`, `workspace-detector.test.js`
- Bridge: `task-complete.test.ts`, `handoff-prompt.test.ts`

## 1.3.0 — 2026-06-19

### Added
- **Rehber modu:** Panel toggle (Asistan / Rehber), `start-goal-session` plan + turuncu imleç + Tamamladım akışı
- **Ekran Al butonu:** Manuel ekran görüntüsü önizlemesi; otomatik capture varsayılan kapalı (maliyet kontrolü)
- **Cline API senkronu:** Şifreli sidecar + Bridge + Cline fork `syncProviderCredentials`
- Settings: Cline senkron durumu ve "Cline'a senkronla" butonu
- IPC: `get-cline-sync-status`, `sync-cline-credentials`; plan IPC'leri `images` kabul eder

### Changed
- Orchestrator: adım ilerletme için kullanıcı ekran görüntüsü zorunlu; otomatik `captureScreenTool` kaldırıldı
- Rehber modunda intent router browser plugin'e yönlendirmez
- İmleç `waiting_user` durumunda süresiz görünür

### Tests
- `cline-credential-bridge.test.js`

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
