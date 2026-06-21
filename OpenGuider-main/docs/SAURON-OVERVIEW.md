# Sauron Overview (v1.0)

Sauron is a desktop AI assistant (Electron) focused on **live screen micro-guide** and **Cline workspace handoff** as the primary workflow. Secondary capabilities include planned guide mode, memory chat, FinOps cost routing, Web Studio scaffolding, and the optional Browser agent.

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

## Error resilience

Orchestrator post-processing (TTS, pointer) is wrapped in `safeHandleOrchestratorResult` so LLM success is not lost when post-process fails.

## Manual validation

See [MANUAL-TEST-CHECKLIST.md](./MANUAL-TEST-CHECKLIST.md) — run handoff regression after each release phase.
