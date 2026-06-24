<!-- sauron-gamedev-version: 2.0 -->
# Sauron Game Dev — MCP Kuralları (Unity)

## Altın kural
**LLM düşünür (az), MCP yapar (çok).** 67 MCP tool'un tamamı kullanılabilir — kısıtlama yok.

## Tool-first
| Görev | MCP tool | Dosya okuma |
|-------|----------|-------------|
| Sahne | `unity_get_hierarchy` (veya eşdeğeri) | Assets tarama yok |
| Obje | `unity_create_*` | — |
| Fizik | `unity_*physics*`, rigidbody, raycast | — |
| Playtest | `unity_play_mode` veya eşdeğeri | — |

## Token tasarrufu
1. MCP tool çağrıları LLM token harcamaz.
2. Plan: handoff maddelerini takip et; transcript tekrar gönderme.
3. Scene cache: `.sauron/gamedev-scene-cache.json`
4. Delta handoff: aynı hedefte workspace tree tekrar yok.
5. Economy model plan için yeterli.

## Onay
Sahne silme, play mode, commit/push → kullanıcı onayı.

## Engine
Aktif: **Unity**. Diğer engine tool'larını bu görevde kullanma.

## Bridge
Unity Package Manager Git URL: https://github.com/CoplayDev/unity-mcp.git?path=/MCPForUnity#main
