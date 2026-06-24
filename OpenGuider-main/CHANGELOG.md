# Changelog

## 2.2.10 — 2026-06-24

### Fixed — Ekran rehberliği sohbet güncellemesi
- **Başlat** sonrası yapay zeka cevabı artık uygulamayı yeniden açmadan sohbette görünür
- Mikro rehber IPC tamamlanınca oturum anlık görüntüsü sohbet arayüzüne yazılır (streaming sırasında atlanan `session-updated` senkronu)

## 2.2.9 — 2026-06-24

### Fixed — Mikro rehber + ses (PTT)
- **⏺ Kayıt butonu**: Whisper artık main process IPC ile çalışır; boş API key ile renderer'dan 401 gitmez
- **STT fallback**: Whisper key yoksa AssemblyAI'ye (veya tersi) otomatik düşer; key yoksa net Türkçe uyarı
- **OpenAI key**: Whisper seçiliyken `openaiApiKey` de kabul edilir
- **Mikro rehber intent**: "ekranımdaki…", "ekranımda gördüğün…" gibi Türkçe ekran cümleleri mikro-tura yönlendirilir

## 2.2.8 — 2026-06-24

### Fixed — Goose DeepSeek provider
- Goose CLI `deepseek` provider tanımıyor → Balanced mod artık **openai** + `GOOSE_PROVIDER__HOST=https://api.deepseek.com/v1` kullanıyor
- `Unknown provider: deepseek` hatası giderildi

## 2.2.7 — 2026-06-24

### Fixed — Goose PowerShell launcher (Turkish paths)
- **EVERYTHİNG/goose.exe**: Yol artık `launch.json` (UTF-8) üzerinden okunuyor; ps1 içine gömülü İ karakteri bozulmuyor
- PowerShell 5.1 için `launch.ps1` UTF-8 BOM ile yazılıyor
- Goose binary yolu spawn öncesi `resolveBinaryPathOnDisk` ile doğrulanıyor

## 2.2.6 — 2026-06-24

### Fixed — Goose terminal spawn (Windows)
- **Çok satırlı `--system`**: Windows Terminal + `cmd /k` zinciri artık talimat metnini exe sanmıyor
- PowerShell launcher (`launch.ps1`) sistem talimatlarını dosyadan okuyup Goose'a güvenli argv ile iletir
- `0x80070002` / "The system cannot find the file specified" hatası giderildi

## 2.2.5 — 2026-06-24

### Fixed — Workspace auto-repair (Goose + Game Dev)
- **Temp workspace otomatik düzeltme**: `AppData\Local\Temp\sauron-temp_*` veya Sauron kaynak kodu algılanınca `Desktop/SauronWorkspace` oluşturulur ve kaydedilir
- **Game Dev**: Oyun planı olmadan 🎮 → VS Code açılır (kurulum sihirbazı yalnızca handoff oturumunda)
- **Başarılı Game Dev activate** → `gamedevSetupComplete` otomatik true
- **Goose**: EVERYTHİNG/goose-package yolu otomatik aranır; bulununca `gooseBinaryPath` kaydedilir
- **pick-workspace-folder**: Sauron kaynak kodu seçimi engellenir

## 2.2.3 — 2026-06-24

### Fixed — Game Dev button reliability
- **Bridge kurulumu**: 🎮 artık ⌘ Çalışma Kısmı gibi VS Code + Sauron Bridge önkoşullarını kontrol eder
- **Yanlış session tetikleme**: Sohbet kutusundaki metin oyun planı olmadan pipeline başlatmaz; boş planda `activate-gamedev-mode` → VS Code açılır
- **Workspace bootstrap**: Game Dev açılışında `.vscode/extensions.json`, MCP config ve clinerules yazılır
- **Eksik klasör**: Var olmayan workspace yolu erken hata verir

## 2.2.2 — 2026-06-24

### Added — Unreal Engine support
- **`unreal-empty-v1` pipeline**: UE faz hedefleri (`unreal_get_world_outliner`, `unreal_spawn_actor`, `unreal_play_mode`)
- **Engine-aware genre router**: `gamedevActiveEngine: unreal` → Unreal pipeline; Unity preset şablonları Unreal'de devre dışı
- **Unreal bridge probe**: TCP 55557 doğrulama (`probeUnrealBridge`, `runUnrealPlayModeVerification`)
- **Doctor**: `.uproject` kontrolü, Unreal bridge port check
- **Ayarlar**: Unreal Engine seçeneği etkin

### Fixed
- **🎮 Game Dev butonu**: görev/plan yazılmadan da VS Code açılır (`activate-gamedev-mode`)
- **VS Code feedback**: `launchResult` activate yanıtına eklendi

## 2.2.1 — 2026-06-24

### Added — Universal game adaptation
- **Evrensel pipeline (varsayılan)**: `custom` şablon — GTA, puzzle, eğitim, mobil ve tüm oyun fikirleri için `unity-empty-v1` + brief analizi
- **`gamedev-brief-analyzer`**: archetype/mechanic tespiti (open-world, educational, puzzle, mobile, RPG, …)
- **Evrensel faz derleme**: her faz hedefi brief'ten türetilir; PEAK/Feign/Zort yalnızca bilinçli seçim veya güçlü tek-genre sinyalinde
- **Akıllı auto mod**: belirsiz/çoklu keyword → custom; zengin brief → custom; hızlı şablonlar opt-in

### Changed
- Varsayılan şablon: `auto` → `custom`
- UI: "Özel oyun — her fikir (önerilen)"; hızlı şablonlar ayrı etiketlendi

## 2.2.0 — 2026-06-24

### Added — Prompt Fabrikası (Game Dev v2.2)
- **`gamedev-prompt-compiler`**: master prompt → `.sauron/game-design-brief.json` + customized phase goals (0-token heuristic default; optional `game-dev-plan` LLM)
- **Master Prompt UI**: Game Studio “Oyun planım” textarea + `gamedevUseLlmPlan` settings toggle
- **Brief pointer handoff**: full brief never embedded — pointer + ~120 char summary only
- **Wire recipes**: 21 genre×phase recipes + optional `gamedev-wire-executor` (MCP 0-token)
- **Template depth**: genre prefab stubs, Editor Host/Join debug menu
- **Instructions v3.1**: 74 tools, brief, wire, pipeline pointers
- **FinOps badge**: brief compile source + phase token estimate in status
- **Doctor**: brief file, wire recipe coverage, prefab scaffold checks
- **Playtest gate**: final phase requires Unity bridge for `unity_play_mode` verification

### Fixed
- **Pipeline phases bug**: runtime uses `pipelineState.phases` (compiler output) instead of registry template only

### Preserved
- `mcpTools: "full"`, bounded handoff, build/goose/⌘ channels unchanged

## 2.1.0 — 2026-06-24

### Added — Game Dev Production System
- **Auto-chain**: `advanceGamePipelineAfterComplete` + `refreshGamePipeline` UI poll (build-pipeline parity)
- **Phase handoffs**: `gamedev-phase-handoff.js` — economy fields preserved per phase
- **Playable Unity scaffold**: scenes, shared Editor bootstrap, bundled asset stubs per genre
- **MCP +7 tools**: `unity_set/edit/grep_scripts`, `unity_save/load_scene`, `unity_save_as/instantiate_prefab`
- **Wire recipes**: `.sauron/unity-wire-recipes/` + handoff pointer (0-token)
- **FinOps honesty**: real `mcp-tool` ledger on MCP dispatch; removed launch-time fake playtest log
- **Scene cache v2**: optional hierarchy snapshot (`rootCount`, bounded `lastPaths`)
- **3-step setup wizard**: workspace probe, bridge check, doctor + template (PEAK/Zort/Feign labels)
- **CLI**: `scripts/scaffold-unity-template.js`
- **Doctor**: gamedev pipeline auto-chain + Unity bridge TCP 7890 live probe

### Preserved
- `mcpTools: "full"`, bounded handoff, `includeTranscript: false`, build/goose channels unchanged

## 2.0.0 — 2026-06-24

### Added — Game Dev Studio (FAZ 3–6)
- **Game pipeline** engine: `unity-empty-v1`, `unity-co-op-climb-v1`, `unity-horror-coop-v1`, `unity-social-deduction-v1`
- Unity genre templates with Netcode for GO skeleton (co-op climb, horror co-op, social deduction)
- `gamedev-genre-router` — keyword + settings template resolution
- Game Studio UI: template picker, pipeline bar, setup wizard, dashboard link
- IPC: `game-pipeline-*` handlers; state in `.sauron/game-pipeline.json`
- Docs: `SAURON-GAMEDEV-ROADMAP.md`

### Preserved — Token economy v2
- `mcpTools: "full"`, 0-token plan bullets, scene cache pointer, bounded handoff
- `gamedevPipelineAutoChain` for phase progression

## 1.9.1 — 2026-06-24

### Fixed — Game Dev stabilite
- Game Dev badge IPC yarışı: tek UI kaynağı (`applyGamedevUiFromResult`), deactivate dışında broadcast kaldırıldı
- VS Code güvenilir açılış: `force` / focus-then-launch (⌘ Çalışma Kısmı ile aynı pattern)
- `gamedevModeActive` electron-store'da kalıcı; ikinci 🎮 tıklaması modu kapatmaz
- `resolveGamedevTaskText` yalnızca plan paneli görünürken plan metnini kullanır

### Added
- `predist:win` öncesi `gamedev-all-in-one` otomatik build + dist varlık kontrolü
- Doctor: electron-core workspace için Unity proje yolu uyarısı

## 1.9.0 — 2026-06-24

### Added — Game Dev OS (FAZ 0–2)
- **🎮 Game Dev** header button + empty-state **Oyun yap** CTA (visibility fixes)
- `gamedev-all-in-one` MCP bundled in Windows installer (`extraResources`)
- MCP config writes to `.cursor`, `.vscode`, `.cline`, and workspace `mcp.json`
- Token economy v2: scene cache, delta handoff, economy routing, FinOps ledger
- Game Dev Doctor checks (MCP entry, engine, Unity bridge hint)
- `sauron-gamedev.md` v2 tool-first playbook (auto-seeded in workspace)
- `game-dev-plan` FinOps economy operation

### Fixed
- Header `overflow` clipping 🎮 button on narrow panels
- `gamedev-all-in-one` Windows `npm run build` (cross-platform copy)

## 1.5.0 — 2026-06-21

### Added
- **Yerel Kod Agent (Code Native):** workspace sandbox, dosya araçları, orchestrator, diff onayı, FinOps operation'ları
- Ayarlar → Eklentiler: `codeAgentNativeEnabled` (varsayılan kapalı)
- Code Studio penceresi, codebase index/retrieval, pipeline native dual-path
- IPC: `start-code-agent-session`, `open-code-studio`, `index-workspace-code`

## 1.4.3 — 2026-06-20

### Fixed
- Preload API: `channel-registry` yolu `path.join(__dirname, ...)` ile paketlenmiş uygulamada güvenilir yükleme
- Kırmızı "Sauron API yüklenemedi" banner kaldırıldı; panel sessiz retry ile başlar
- **Başlangıç akışı:** önce widget (IDLE çubuğu), panel yalnızca widget'tan veya tray'den açılır (OpenGuider davranışı)

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
