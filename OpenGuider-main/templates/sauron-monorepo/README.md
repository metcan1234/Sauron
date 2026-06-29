# Sauron Monorepo Stack

Bu iskelet tam Sauron stack kurulumu için rehber workspace'tir.

## Bileşenler

| Bileşen | Yol | Rol |
|---------|-----|-----|
| OpenGuider Core | `../OpenGuider-main/` | Electron panel, handoff, FinOps |
| Sauron Bridge | `../sauron-vscode-bridge/` | Cline handoff + cost routing |
| Cline fork | `../cline-main/apps/vscode/` | Kod üretimi agent |

## Kurulum

1. Sauron Settings → workspace path bu klasör veya OpenGuider-main
2. `scripts/install-sauron-stack.ps1` çalıştır
3. Self-Build Studio → Tam stack pipeline

## Cline kuralları

`.clinerules/` altında electron + bridge paketleri seed edilir.

## Not

Bu şablon kod kopyası değildir; Cline fazlı handoff ile stack'i tamamlar.
