# Sauron Asistan

Tek klasörde toplanmış Sauron geliştirme ve çalışma alanı (v2.4 backend + tam Goose/Game Dev panel UI).

## Klasör yapısı

```
Sauron Asistan/
├── OpenGuider-main/       Sauron Core (Electron) — sohbet, planlama, kanallar
├── sauron-vscode-bridge/  VS Code handoff köprüsü (Cline)
├── cline-main/            Cline fork (workspace stack)
├── goose-package/         Goose CLI (goose.exe)
├── workspace/             Varsayılan proje klasörü (⌘ / Goose / Game Dev)
└── README.md              Bu dosya
```

## Hızlı başlangıç

```powershell
cd "C:\Users\Can\OneDrive\Desktop\EVERYTHİNG\Sauron Asistan\OpenGuider-main"
npm install
npm run terminal
```

Bridge VSIX (ilk kez veya eksikse):

```powershell
cd "..\sauron-vscode-bridge"
npm install
npm run package
```

Doğrulama:

```powershell
cd "..\OpenGuider-main"
npm run verify:channels
npm run test:unit
```

## Önemli yollar

| Ne | Yol |
|----|-----|
| Workspace (Ayarlar → Çalışma Kısmı) | `...\Sauron Asistan\workspace` |
| Goose binary | `...\Sauron Asistan\goose-package\goose.exe` |
| Bridge VSIX | `...\sauron-vscode-bridge\dist\sauron-vscode-bridge.vsix` |
| Game Dev MCP | `OpenGuider-main\extensions\gamedev-all-in-one\dist\index.js` |

İlk açılışta **Ayarlar → Çalışma Kısmı** içinde workspace yolunu yukarıdaki `workspace` klasörüne ayarlayın.

## Kanallar (panel)

- **⌘ Çalışma Kısmı** — VS Code + Cline handoff
- **🪿 Goose** — terminal CLI ajanı
- **🎮 Game Dev** — Unity/Unreal MCP, kurulum sihirbazı, studio bar

## Cursor / IDE

Bu klasörü veya `OpenGuider-main` altını workspace olarak açın:

`C:\Users\Can\OneDrive\Desktop\EVERYTHİNG\Sauron Asistan`

## Yeni exe (isteğe bağlı)

```powershell
cd OpenGuider-main
npm run dist:win
```

Installer `OpenGuider-main\dist\` altında oluşur.

## Eski klasörleri silme (doğrulama sonrası)

`npm run verify:channels` ve `npm run terminal` başarılı olduktan sonra güvenle silebilirsiniz:

- `C:\Users\Can\OneDrive\Desktop\EVERYTHİNG\AL ENGİNEER\PROJELERİM\SAURON` (tüm alt klasörler)
- `C:\Users\Can\OneDrive\Desktop\EVERYTHİNG\AL ENGİNEER\PROJELERİM\Sauron-main` (junction)
- `C:\Users\Can\OneDrive\Desktop\SauronWorkspace`

**Notlar:**

- Masaüstü `Sauron.lnk` eski kurulum exe’sine gider — yeni kısayol için `npm run terminal` veya yeni installer kullanın.
- `AppData\Local\Programs\Sauron` eski kurulumdur; silmek zorunlu değil.
