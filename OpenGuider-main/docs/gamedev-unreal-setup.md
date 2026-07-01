# Unreal Game Dev Kurulumu

Sauron Game Dev kanali Unreal Editor ile konusur. **Funplay** onceliklidir:

| Transport | Port | Aciklama |
|-----------|------|----------|
| HTTP | **8765** | Funplay Unreal MCP (Cline `funplay-unreal` npx) |
| TCP | **55557** | Legacy ue-mcp (geriye uyumluluk) |

## Otomatik kurulum (Sauron v2.5.2+)

Game Dev modunu actiginizda Sauron:

1. `.sauron/engine-compat.json` yazar
2. `Plugins/FunplayMCP/` bootstrap + kurulum readme olusturur (plugin yoksa)
3. MCP config'e `gamedev-all-in-one` + `funplay-unreal` ekler (mevcut satirlari silmez)

## 1. Unreal Editor

- UE 5.3+ onerilir (Windows)
- Blueprint veya C++ proje acin

## 2. Funplay MCP plugin

1. [FunplayAI/funplay-unreal-mcp](https://github.com/FunplayAI/funplay-unreal-mcp/releases) indir
2. `FunplayMCP/` klasorunu proje `Plugins/FunplayMCP/` altina kopyala
3. Edit → Plugins → Funplay MCP for Unreal → Enable
4. Tools → Funplay MCP → Start (HTTP **8765**)

## 3. Sauron tarafinda

- Ayarlar → Calisma Kismi: `.uproject` iceren klasor
- Ayarlar → Game Dev → engine: **unreal**
- Doctor: `gamedev-unreal-bridge`, `gamedev-compat-manifest`

## 4. Sorun giderme

- Bridge kapali: Editor acik mi, Funplay MCP baslatildi mi
- Token: `Saved/FunplayMCP/funplay_mcp_settings.json` Sauron tarafindan okunur
- Play/PIE: HTTP MCP aktifken Cline `funplay-unreal` araclari kullanilir

## UE hazir olunca

Sauron'a yaz: **"UE proje acildi, yol: …"** — birlikte Faz 1 bridge testi yapilir.
