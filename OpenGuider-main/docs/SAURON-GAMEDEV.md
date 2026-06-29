# Sauron Game Dev (gamedev-all-in-one)

Game Dev, Sauron'da **4. kanal**dır — panel sohbeti, ⌘ Çalışma Kısmı ve 🪿 Goose'dan bağımsızdır.

**v2.1** (production): auto-chain pipeline, playable Unity scaffold, +7 MCP tools, wire recipes, honest FinOps ledger.  
**v2.0**: Game pipeline, genre templates, Game Studio UX. See [SAURON-GAMEDEV-ROADMAP.md](./SAURON-GAMEDEV-ROADMAP.md).

## Panel

- **🎮** — Game Dev modu / handoff
- **Şablon seçici** — Boş / Co-op Climb (PEAK) / Horror Co-op (Zort) / Social Deduction (Feign)
- **Pipeline bar** — canlı faz durumu + auto-chain ilerleme
- **3 adımlı kurulum sihirbazı** — workspace, bridge, doctor
- Görev metni **yoksa**: modu aç/kapa (MCP config workspace'e yazılır)
- Görev metni **varsa**: pipeline faz hedefi + MCP config + economy handoff + VS Code (Cline)

## Auto-chain (v2.1)

1. Cline görev bitince Bridge `.sauron/cline-task-complete.json` yazar
2. Panel `refreshGamePipeline` → `advance-game-pipeline`
3. Doğrulama (opsiyonel `unity_play_mode`, bridge yoksa skip)
4. Sonraki faz handoff otomatik yazılır (`gamedevPipelineAutoChain` açıkken)

## Token tasarrufu (gamedev kısıtlanmadan)

| Katman | Maliyet |
|--------|---------|
| MCP tool çağrıları (74 tool) | **0 LLM token** — yerel TCP/HTTP |
| Handoff özeti | `finopsHandoffMaxChars` (varsayılan 4000) |
| Faz plan bullets | 0-token (`phase.goal` parse) |
| Wire recipe | pointer only — JSON workspace'te |
| Cline model önerisi | `complexityHint: low` → economy agent |
| Transcript | `finopsHandoffIncludeTranscript: false` |

**Yapılmaz:** Tool listesi LLM context'ine gömülmez; tüm MCP araçları kullanılabilir.

## Dosyalar

- `.cursor/mcp.json`, `.vscode/mcp.json`, `.cline/mcp.json`, `mcp.json` — `gamedev-all-in-one` MCP sunucusu
- `.clinerules/sauron-gamedev.md` — v3 tool-first playbook (auto-seeded)
- `.sauron/gamedev-scene-cache.json` — scene bağlamı + hierarchy snapshot (bounded)
- `.sauron/gamedev-finops.jsonl` — gerçek MCP tool dispatch ledger
- `.sauron/game-pipeline.json` — aktif pipeline fazı
- `.sauron/unity-wire-recipes/` — MCP adım sırası (genre fazları)
- `Assets/SauronGameDev/{genre}/` — scaffold scripts + `Scenes/Main.unity`
- `.sauron/handoff-*.json` — `channel: "gamedev"`, `wireRecipe`, `pipelinePhase`

## Unity bridge (ayrı kurulum)

`gamedev-all-in-one` Unity C# bridge değildir. Unity Editor'da:

Package Manager → Git URL: `https://github.com/CoplayDev/unity-mcp.git?path=/MCPForUnity#main`

Doctor (Ayarlar → Çalışma Kısmı) bridge durumunu gösterir.

## MCP yolu

Varsayılan: `extensions/gamedev-all-in-one/dist/index.js`  
Özel yol: store `gamedevMcpEntryPath`

## IPC

- `toggle-gamedev-mode`
- `start-gamedev-session`
- `get-gamedev-status`
- `deactivate-gamedev-mode`
- `probe-gamedev-mcp`
