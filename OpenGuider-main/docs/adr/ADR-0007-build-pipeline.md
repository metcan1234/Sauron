# ADR-0007: Build Pipeline + Task Complete Protocol

## Durum

Kabul edildi — 2026-06-19

## Bağlam

v1.3 ile rehber modu ve credential sync geldi; ancak Cline görev bitince Core geri bildirim almıyordu. Self-build (dogfood) için fazlı handoff zinciri gerekli.

## Karar

1. **Build Pipeline modülü** — önceden tanımlı faz şablonları, `build-pipeline.json` state
2. **Task complete artifact** — Bridge yazar `.sauron/cline-task-complete.json`
3. **Cline fork lifecycle API** — `getTaskState`, `clearTask`, `getLastTaskSummary`
4. **autoChain** — `true` iken aktif görev `clearTask` ile sonlandırılır, modal atlanır
5. **projectType + clinerules packs** — workspace tipine göre Cline kuralları

## Sonuçlar

- Yarı otomatik çok fazlı üretim (kurumsal web, self-improve, bridge)
- Core kod yazmaz; orchestrator rolü korunur
- Fork Cline birincil; Marketplace degrade

## Alternatifler

- Cline event subscription — v1.4 kapsam dışı; dosya artifact yeterli
- Tam otomatik ask auto-approve — güvenlik riski, reddedildi
