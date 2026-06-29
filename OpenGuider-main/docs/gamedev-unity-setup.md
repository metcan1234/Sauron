# Unity Game Dev Kurulumu

Sauron Game Dev kanali Unity Editor ile TCP uzerinden konusur (port **7890**).

## 1. Unity Editor

- Unity Hub uzerinden proje acin
- Unity 2022.3+ onerilir

## 2. MCP plugin (CoplayDev unity-mcp onerilir)

1. [CoplayDev/unity-mcp](https://github.com/CoplayDev/unity-mcp) veya IvanMurzak/Unity-MCP kurun
2. Unity icinde MCP server'in calistigini dogrulayin
3. TCP bridge `127.0.0.1:7890` dinlemeli

## 3. Sauron tarafinda

- Game Dev modunu acin
- Doctor: `gamedev-mcp-entry` ve `gamedev-unity-bridge` kontrolleri
- Handoff sahne ozeti `.sauron/gamedev-scene-cache.json` uzerinden delta gonderir

## 4. Sorun giderme

- MCP entry yok: `cd OpenGuider-main/extensions/gamedev-all-in-one && npm run build`
- Bridge baglanmiyor: Unity Editor acik mi, plugin aktif mi kontrol edin
