# Unity Game Dev Kurulumu

Sauron Game Dev kanali Unity Editor ile konusur. Coplay **unity-mcp** onceliklidir:

| Transport | Port | Aciklama |
|-----------|------|----------|
| HTTP | **8080** | Coplay unityMCP (Cline `unityMCP` sunucusu) |
| TCP | **6400** | Coplay Unity TCP bridge |
| TCP | **7890** | Legacy Unity MCP (geriye uyumluluk) |

## Otomatik kurulum (Sauron v2.5.2+)

Game Dev modunu actiginizda veya oturum baslattiginizda Sauron:

1. `.sauron/engine-compat.json` yazar
2. `Packages/manifest.json` icine `com.coplaydev.unity-mcp` ekler (yoksa)
3. `.cursor/mcp.json` ve `.vscode/mcp.json` icine `gamedev-all-in-one` + `unityMCP` birlestirir (mevcut sunuculari silmez)

## 1. Unity Editor

- Unity Hub uzerinden proje acin
- Unity 2022.3+ onerilir

## 2. MCP plugin (CoplayDev unity-mcp)

1. [CoplayDev/unity-mcp](https://github.com/CoplayDev/unity-mcp) — Sauron manifest'e otomatik ekleyebilir
2. Unity icinde Window → MCP for Unity → Start Server
3. Doctor: HTTP **8080** veya TCP **6400** acik olmali

## 3. Sauron tarafinda

- Calisma Kismi: Unity proje klasoru (`Assets/` iceren)
- Game Dev → Tek tik fix veya mod acma
- Doctor: `gamedev-unity-bridge`, `gamedev-compat-manifest`

## 4. Sorun giderme

- MCP entry yok: `cd OpenGuider-main/extensions/gamedev-all-in-one && npm run build`
- Bridge baglanmiyor: Unity Editor acik mi, Coplay MCP server baslatildi mi
- Eski 7890: Coplay kuruluysa 8080/6400 kullanin
