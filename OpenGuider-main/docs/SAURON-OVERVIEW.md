# Sauron Overview (v1.2)

Sauron is a desktop AI assistant (Electron) focused on **live screen micro-guide** and **Cline workspace handoff** as the primary workflow. Secondary capabilities include planned guide mode, memory chat, FinOps cost routing, Web Studio scaffolding, and the optional Browser agent.

## Solo-user checklist (v1.2)

1. **Doctor yeşil** — Ayarlar → Çalışma Kısmı: workspace, gerçek VS Code CLI (Cursor değil), Bridge, Cline, API key.
2. **Sabit workspace** — `workspacePath` electron-store'da kalıcı; handoff aynı projeye gider.
3. **İsteğe bağlı özellikler** — Ayarlar → Eklentiler: Web Studio, Self-Build, Browser aç/kapa; kapalıyken panel girişleri gizlenir.
4. **Kişisel varsayılanlar** — Provider: AI Ajanları; bütçe: Bütçe/FinOps; mod: varsayılan Asistan (panel rozeti).
5. **Cline kuralları** — `.clinerules/sauron-workspace.md` sürüm `1.2`; handoff/bootstrap eski sürümü günceller.

## Primary story

1. **Mikro-tur rehber** — Single-step screen guidance with pointer overlay. Trigger via empty-state CTA, 🎯 button, or natural-language screen-help intent.
2. **Çalışma Kısmı handoff** — Send coding tasks to VS Code + Cline via Sauron Bridge (`⌘` / empty-state CTA).

## Secondary features

| Feature | Purpose |
|---------|---------|
| Planlı rehber | Multi-step UI plan with evaluator loop (max 6 steps) |
| Hafızalı sohbet | Persistent chat sessions with optional compression |
| FinOps | Economy-tier routing for planner/locator/evaluator when optimizer is on |
| Web Studio | Corporate site scaffold wizard (optional) |
| Browser agent | Python sidecar automation (optional) |

## Prerequisites

| Requirement | Needed for |
|-------------|------------|
| AI provider API key | Chat, guide, micro-guide |
| VS Code + `code` CLI | Workspace handoff |
| Sauron Bridge VSIX | Panel ↔ VS Code IPC |
| Cline extension | Auto task start in VS Code (recommended) |
| Workspace folder path | Handoff, Web Studio scaffold |
| Python runtime | Browser agent only (optional) |
| Node.js + npm | Web Studio scaffold (optional) |

Run **Ayarlar → Workspace → Sistem tanısı** (`run-sauron-doctor`) to verify setup.

## Mode matrix

| Panel badge | Route (`resolveMessageRoute`) | IPC channel |
|-------------|----------------------------|-------------|
| Asistan | `assistant_chat` | `send-message` |
| Rehber · Planlı | `plan_guide` | `start-goal-session`, plan actions |
| Rehber · Mikro-tur | `micro_guide` / busy | `start-micro-guide-session`, `micro-guide-done`, `micro-guide-cancel` |

### Routing priority

1. Active micro session → `micro_guide_busy` (use Yaptım / İptal)
2. Micro intent detected → `micro_guide` (even in Rehber mode)
3. Rehber mode, no micro intent → `plan_guide`
4. Default → `assistant_chat`

Renderer delegates routing to main via `resolve-message-route` IPC (see `src/routing/message-route.js`).

## Handoff context (v1.1)

Before writing `.sauron/handoff-*.json`, Sauron enriches the Cline task with:

1. **Workspace snapshot** — shallow 1–2 level tree, package name/scripts, layout hint (capped ~700 chars; no file contents).
2. **Clarified task** — optional single economy-tier LLM pass (`handoff-task-clarify`) that adds an action-oriented summary beside the original chat context; failures are skipped silently.
3. **Cline rules** — `.clinerules/sauron-workspace.md` seeded on bootstrap (token discipline + Cursor-style quality gates).

Doctor **readiness** banner summarizes solo setup (workspace, VS Code CLI, Bridge, Cline, API key) with numbered fix steps and settings deep-links. Optional features (Browser, Web Studio, Self-Build) can be disabled in Settings → Plugins without removing code.

## Error resilience

Orchestrator post-processing (TTS, pointer) is wrapped in `safeHandleOrchestratorResult` so LLM success is not lost when post-process fails.

## Manual validation

See [MANUAL-TEST-CHECKLIST.md](./MANUAL-TEST-CHECKLIST.md) — run handoff regression after each release phase.
