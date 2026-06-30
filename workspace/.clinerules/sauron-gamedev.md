<!-- sauron-gamedev-version: 3.2 -->
# Sauron Game Dev — MCP Kuralları (Unity)

## Altın kural
**LLM düşünür (az), MCP yapar (çok).** 74 MCP tool'un tamamı kullanılabilir — kısıtlama yok.

## Tool-first
| Görev | MCP tool | Dosya okuma |
|-------|----------|-------------|
| Sahne | `unity_get_hierarchy` | Assets tarama yok |
| Obje | `unity_create_*` | — |
| Fizik | `unity_*physics*`, rigidbody, raycast | — |
| Playtest | `unity_play_mode` | — |
| Script | `unity_script` | — |
| Scene | `unity_scene` | — |

## Prompt Fabrikası (v2.2+)
1. Oyun planı: `.sauron/game-design-brief.json` — handoff'ta yalnızca pointer + 1 satır özet.
2. **Her oyun fikri desteklenir** (GTA, puzzle, eğitim, mobil, RPG…) — brief archetype analizi + evrensel faz hedefleri.
3. Hazır şablonlar (climb/horror/social) yalnızca Unity + kullanıcı seçerse veya çok güçlü tek-genre sinyali varsa.
4. Wire recipe pointer: `.sauron/unity-wire-recipes/{genre}-phase{N}.json` (Unity)
5. Pipeline state: `.sauron/game-pipeline.json`

## Token tasarrufu
1. MCP tool çağrıları LLM token harcamaz.
2. Plan: handoff maddelerini takip et; transcript tekrar gönderme.
3. Scene cache: `.sauron/gamedev-scene-cache.json`
4. Delta handoff: aynı brief hash'te workspace tree tekrar yok.
5. Economy model plan için yeterli; opsiyonel `game-dev-plan` LLM yalnızca ayarlarda açıksa.

## Onay
Sahne silme, play mode, commit/push → kullanıcı onayı.

## Engine
Aktif: **Unity**. Diğer engine tool'larını bu görevde kullanma.

## Bridge
Unity Package Manager Git URL: https://github.com/CoplayDev/unity-mcp.git?path=/MCPForUnity#main
