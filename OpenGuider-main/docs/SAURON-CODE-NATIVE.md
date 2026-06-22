# Sauron Code Native (v1.5.0)

Native code agent: workspace içinde dosya okuma/yazma, grep, terminal ve test döngüsü — Cline/Cursor handoff olmadan.

## Rollout

- `codeAgentNativeEnabled` varsayılan **kapalı** — Ayarlar → Eklentiler → "Yerel Kod Agent"
- Handoff (⌘) ve Cline yolu legacy olarak kalır

## FinOps operations

| Operation | Tier |
|-----------|------|
| `code-agent-plan` | economy |
| `code-agent-act` | complexity-based |
| `code-agent-repair` | medium |
| `code-agent-summarize` | economy |
| `code-grep-context` | economy |
| `code-read-summarize` | economy |

Tüm LLM çağrıları `streamAIResponse` / `invokeStructuredChain` üzerinden; `prepareLlmCall` bypass yok.

## Architecture

```
Panel → resolveMessageRoute(code_agent) → code-orchestrator
  → codebase-retriever (local, no LLM)
  → code-tools (sandboxed)
  → diff approval (trustLevel)
  → run-terminal (npm test)
```

State: `.sauron/code-agent-session.json`  
Index: `.sauron/code-index.json`
