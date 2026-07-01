# Unity Game Dev Kurulumu

Sauron **v2.5.3+** ile Unity tarafinda otomatik:

| Adim | Kim yapar |
|------|-----------|
| `Packages/manifest.json` → Coplay unity-mcp | **Sauron** |
| MCP config + compat | **Sauron** |
| Unity kapaliysa editor ac | **Sauron** (varsayilan) |
| Bridge 8080/6400 beklenir | **Sauron** |
| Oyunu Cline ile kurma | **Sen** |

## Portlar

| Transport | Port |
|-----------|------|
| HTTP (Coplay) | **8080** |
| TCP | **6400** |
| Legacy | **7890** |

## Akis

1. Unity proje klasorunu Sauron **Calisma Kismi** yap
2. **Game Dev** modunu ac
3. Unity acilir, paket import olur, MCP server baslat (Window → MCP for Unity → Start gerekebilir)
4. Cline oturumu

## Ayarlar

- `gamedevAutoEditorLaunch` — otomatik Unity acma (default: acik)

## Sorun giderme

- Bridge kapali: Unity Editor acik + Coplay MCP Start
- Paket eklenmedi: Game Dev → Tek tik fix
