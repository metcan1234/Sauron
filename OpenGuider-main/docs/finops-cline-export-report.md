# Cline Maliyet Export Raporu

## Durum (Faz 4A — uygulandı)

Cline fork public API'sine `getActiveTaskMetrics()` eklendi. Bridge, görev tamamlandığında workspace `.sauron/usage/logs.jsonl` dosyasına `operation: "cline-task"` kaydı yazar. OpenGuider Settings özeti aynı dosyadan Core + Cline toplamını okur.

## Bileşenler

| Bileşen | Konum | Not |
|---------|-------|-----|
| Cline export | `cline-main/apps/vscode/src/exports/` | `getActiveTaskMetrics()` — `getApiMetrics()` reuse |
| Bridge monitor | `sauron-vscode-bridge/src/usage/monitor.ts` | 5s poll; task complete emit |
| Bridge export | `sauron-vscode-bridge/src/usage/export.ts` | USD→TL, dedup via `cline-export-state.json` |
| Workspace config | `{workspace}/.sauron/finops-config.json` | Core `save-settings` / handoff sonrası sync |
| Birleşik ledger | `{workspace}/.sauron/usage/logs.jsonl` | Core LLM + Cline bridge |

## Akış

1. Core Settings kaydedilir → `.sauron/finops-config.json` (USD/TL kuru)
2. Cline görevi biter → bridge son metrikleri yazar
3. Core Settings → FinOps sekmesi `get-finops-summary` ile toplam + kırılım gösterir

## Faz 4B–E (tamamlandı — v1.1.0)

- **4B:** Kurulum script (`install-sauron-stack.ps1`), sauron-doctor
- **4C:** Browser plugin FinOps, handoff history panel, E2E smoke tests
- **4D:** Analitik dashboard, hard budget limit, `get-finops-analytics`
- **4E:** ADR belgeleri, CI pipeline, openrouterMaxTokens UI

## Manuel smoke (Faz 4A)

1. Core → Settings → workspace + USD/TL kaydet → `.sauron/finops-config.json` oluşmalı
2. VS Code (fork Cline + bridge) → kısa Cline görevi → `logs.jsonl`'de `cline-task` satırı
3. Core Settings → Harcanan TL ve kırılımda Core + Cline görünmeli
4. Handoff akışı bozulmamalı
