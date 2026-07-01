# Unreal Game Dev Kurulumu

Sauron **v2.5.3+** ile Unreal tarafinda cogu adim otomatik:

| Adim | Kim yapar |
|------|-----------|
| Funplay zip indir + `Plugins/FunplayMCP/` kur | **Sauron** (internet gerekir, bir kez cache) |
| `.uproject` icinde plugin enable | **Sauron** |
| MCP config (`funplay-unreal` + `gamedev-all-in-one`) | **Sauron** |
| Editor acik degilse UnrealEditor ile proje ac | **Sauron** (varsayilan acik) |
| Bridge 8765 beklenir | **Sauron** (~90 sn) |
| Oyunu Cline ile kurma | **Sen** |

## Portlar

| Transport | Port |
|-----------|------|
| HTTP (Funplay) | **8765** |
| Legacy TCP | **55557** |

## Senin tek manuel adimin (ilk kurulum)

1. Epic'ten Unreal Engine kur
2. Blueprint proje olustur
3. Sauron **Calisma Kismi** = `.uproject` klasoru
4. **Game Dev → unreal** → mod ac

Gerisi Sauron. Funplay icinde editor acikken **Tools → Funplay MCP → Start** gerekebilir (ilk acilista).

## Ayarlar (opsiyonel kapatma)

- `gamedevAutoPluginInstall` — Funplay otomatik kurulum (default: acik)
- `gamedevAutoEditorLaunch` — Editor otomatik acma (default: acik)

## Sorun giderme

- Plugin indirilemedi: internet + GitHub erisimi
- Bridge timeout: Editor ac, Funplay Start
- Doctor: `gamedev-unreal-plugin`, `gamedev-unreal-bridge`
