# FinOps Cost Optimizer + 4-Agent Matrix

## Durum

**Phase 1 + Agent Matrix uygulandı:**

- Core handoff sıkıştırma ve complexity hint
- Core otomatik agent routing (Gemini / DeepSeek / Ollama)
- Cline `getActiveModel` / `setActiveModel` fork
- Bridge handoff öncesi Cline model routing + burn-rate governor
- Settings → AI Agents (4 key/URL)

## Agent matrisi

| Katman | low | medium | high | fallback |
|--------|-----|--------|------|----------|
| **Core** | gemini-2.0-flash | gemini-2.0-flash | deepseek-chat | ollama qwen2.5-coder |
| **Cline** | deepseek-chat | gemini-2.5-flash | gpt-4o-mini | ollama |

Kullanıcı yalnızca API key girer; model/tier seçimi otomatiktir.

## Bileşenler

| Bileşen | Konum | Rol |
|---------|-------|-----|
| Agent matrix | `OpenGuider-main/src/sauron/finops/agent-matrix.js` | Core/Cline agent çözümleme, settings sync |
| Optimizer config | `OpenGuider-main/src/sauron/finops/cost-optimizer-config.js` | Tier defaults, complexity hint |
| DeepSeek provider | `OpenGuider-main/src/ai/deepseek.js` | Native OpenAI-compatible API |
| Workspace sync | `OpenGuider-main/src/sauron/finops/workspace-config.js` | `costOptimizer.agentMatrix` yazar |
| Bridge router | `sauron-vscode-bridge/src/cost-optimizer/router.ts` | Handoff → Cline agent |
| Bridge apply | `sauron-vscode-bridge/src/cost-optimizer/apply.ts` | `setActiveModel` before handoff |
| Bridge governor | `sauron-vscode-bridge/src/cost-optimizer/governor.ts` | Günlük bütçe hızı → tier düşür |
| Cline fork | `cline-main/apps/vscode/src/exports/` | `getActiveModel`, `setActiveModel` |

## Workspace config örneği

```json
{
  "enabled": true,
  "finopsUsdToTl": 34.5,
  "costOptimizer": {
    "enabled": true,
    "mode": "balanced",
    "models": {
      "economy": { "providerId": "gemini", "modelId": "gemini-2.0-flash" },
      "standard": { "providerId": "deepseek", "modelId": "deepseek-chat" },
      "premium": { "providerId": "openai", "modelId": "gpt-4o-mini" },
      "local": { "providerId": "ollama", "modelId": "qwen2.5-coder:7b" }
    },
    "routing": {
      "handoffMaxChars": 4000,
      "includeTranscript": false
    },
    "budgetGovernor": {
      "dailyBudgetTl": 50
    },
    "agentMatrix": {
      "version": 1,
      "routing": {
        "core": { "low": "gemini", "medium": "gemini", "high": "deepseek" },
        "cline": { "low": "deepseek", "medium": "gemini", "high": "openai" }
      }
    }
  }
}
```

## Cline key mirror

Cline anahtarları Sauron'dan otomatik kopyalanmaz. Bkz. [`agent-setup-cline.md`](agent-setup-cline.md).

## Beklenen tasarruf

- Handoff context sıkıştırma: ~%10–15
- Core Gemini + Cline DeepSeek ağırlığı: ~%25–40
- Phase 1 + Agent Matrix birlikte: ~%40–55 hedef

## Smoke checklist

1. Settings → AI Agents → 3 key kaydet → kayıt sonrası `aiProvider=gemini`
2. Core sohbet → ledger'da agent/model (Gemini veya DeepSeek)
3. Handoff → `complexityHint` + kısa `taskSummary`
4. Bridge → Cline prompt ≤ `handoffMaxChars`; ledger'da `cline-agent-routing`
5. Cline kurulum doc ile key mirror tamam
6. Optimizer kapalı → eski tier overlay davranışı

## Testler

```bash
cd OpenGuider-main && npm test
cd sauron-vscode-bridge && npm test
```

- `tests/unit/agent-matrix.test.js`
- `tests/unit/finops-cost-optimizer.test.js`
- `sauron-vscode-bridge/src/test/router.test.ts`
- `sauron-vscode-bridge/src/test/provider-mapper.test.ts`
- `cline-main/apps/vscode/src/test/cline-api.test.ts`
