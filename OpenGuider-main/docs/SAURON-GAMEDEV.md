# Sauron Game Dev (gamedev-all-in-one)

Game Dev, Sauron'da **4. kanal**dır — panel sohbeti, ⌘ Çalışma Kısmı ve 🪿 Goose'dan bağımsızdır.

v2.0: Game pipeline, Unity genre templates, Game Studio UX. See [SAURON-GAMEDEV-ROADMAP.md](./SAURON-GAMEDEV-ROADMAP.md).

## Panel

- **🎮** — Game Dev modu / handoff
- **Şablon seçici** — Boş / Co-op Climb / Horror Co-op / Social Deduction
- **Pipeline bar** — aktif faz (0-token, local state)
- Görev metni **yoksa**: modu aç/kapa (MCP config workspace'e yazılır)
- Görev metni **varsa**: pipeline faz hedefi + MCP config + economy handoff + VS Code (Cline)

## Token tasarrufu (gamedev kısıtlanmadan)

| Katman | Maliyet |
|--------|---------|
| MCP tool çağrıları (67 tool) | **0 LLM token** — yerel TCP/HTTP |
| Handoff özeti | `finopsHandoffMaxChars` (varsayılan 4000) |
| Cline model önerisi | `complexityHint: low` → economy agent |
| Clarify LLM | `finopsClarifySkipEnabled` ile atlanır |
| Transcript | `finopsHandoffIncludeTranscript: false` |

**Yapılmaz:** Tool listesi LLM context'ine gömülmez; 67 tool'un tamamı MCP üzerinden kullanılabilir.

## Dosyalar

- `.cursor/mcp.json`, `.vscode/mcp.json`, `.cline/mcp.json`, `mcp.json` — `gamedev-all-in-one` MCP sunucusu
- `.clinerules/sauron-gamedev.md` — v2 tool-first playbook (auto-seeded)
- `.sauron/gamedev-scene-cache.json` — son oturum scene bağlamı (0 token)
- `.sauron/gamedev-finops.jsonl` — MCP vs LLM kullanım ledger
- `.sauron/handoff-*.json` — `channel: "gamedev"`, `deltaHandoff`, `gamedev.engine`

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
