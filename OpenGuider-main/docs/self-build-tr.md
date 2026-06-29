# Self-Build Studio (TR)

Sauron Core kod yazmaz; **Build Pipeline** ile fazlı handoff zinciri oluşturur. Cline fork workspace'te kod üretir.

## Başlangıç

1. Settings → Workspace path (OpenGuider-main klasörü veya hedef proje)
2. Cline **fork** + Sauron Bridge kurulu olsun (Doctor kontrol)
3. Panel → **🔧 Self-Build Studio**

## Hedefler

| Pipeline | Açıklama |
|----------|----------|
| Kendini geliştir | Sauron (OpenGuider-main) özellik/refactor |
| Bridge agent | sauron-vscode-bridge değişiklikleri |
| Kurumsal web | Web Studio sonrası 4 fazlı tamamlama |
| Tam stack | Monorepo rehberi |

## Yarı otomatik akış

1. Pipeline başlat → faz 1 handoff → VS Code/Cline
2. Cline görevi bitirince Bridge `.sauron/cline-task-complete.json` yazar
3. Core doğrulama çalıştırır (varsa `npm test` vb.)
4. Sonraki faz handoff otomatik yazılır (`pipelineAutoChain`, varsayılan açık)

## Maliyet

- Proje-tipi günlük bütçe profilleri (FinOps)
- Faz planında tahmini ~TL badge
- Economy profili: düşük tier modeller

## Sınırlar

- Marketplace Cline: pipeline auto-chain kısıtlı (fork gerekli)
- Git commit/push otomatik değil (.clinerules onay kapıları)
