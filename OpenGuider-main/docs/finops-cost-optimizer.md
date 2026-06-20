# FinOps Cost Optimizer + 4-Agent Matrix

## Durum

**Phase 1 + Agent Matrix uygulandı:**

- Core handoff sıkıştırma ve complexity hint
- Core otomatik agent routing (Gemini / DeepSeek / Ollama)
- Cline `getActiveModel` / `setActiveModel` fork
- Bridge handoff öncesi Cline model routing + burn-rate governor
- Settings → AI Agents (4 key/URL)

## Agent matrisi (v1 — maliyet-bilinçli)

| Katman | low | medium | high | fallback |
|--------|-----|--------|------|----------|
| **Core (panel)** | gemini | gemini | deepseek | ollama |
| **Cline** | deepseek | deepseek | openai (nadir) | deepseek (key yok / governor) |

- Panel sohbet: Gemini ağırlıklı
- Cline günlük kod: DeepSeek varsayılan
- OpenAI: yalnızca sıkı `high` complexity (mimari, auth, schema, çoklu risk)
- Governor: günlük bütçe aşıldığında **yalnızca** high→OpenAI yerine DeepSeek (Ollama'ya otomatik düşüş yok)

## Complexity hint (sıkı)

- **high:** ≥2 risk keyword (`architecture`, `security`, `auth`, `migrate`, `schema`, `database`) veya 1 risk keyword + 400+ kelime veya 1200+ kelime
- **medium:** `refactor` / `rewrite` veya 500+ kelime
- **low:** bug fix, tek dosya, UI/metin — şüphede low

## Agent bakiyeleri (Settings)

Settings → Bütçe / FinOps → **Agent Bakiyeleri**:

- Agent başına limit (USD), harcanan, kalan, token in/out
- Manuel top-up (`+ Bakiye ekle`) — Provider API yok, tahmini ledger toplamı
- Cline kayıtları model adından agent'a map edilir

## Agent limit enforcement

- **Limit = 0:** sınırsız — routing'e etki etmez
- **Limit > 0 ve kalan ≤ 0:** agent routing'den **atlanır**
- **Fallback:** yalnızca bulut agent'lar (Gemini → DeepSeek → OpenAI sırası katmana göre). **Ollama'ya otomatik geçiş yok**
- **Tüm bulut agent'lar tükendi:** çağrı bloklanmaz; toast + `wallet-exhausted-all-cloud` reason; Settings'te **Tükendi** etiketi
- Bridge `.sauron/finops-config.json` sync: her agent için `walletAvailable` alanı

## Bileşenler

| Bileşen | Konum | Rol |
|---------|-------|-----|
| Agent matrix | `OpenGuider-main/src/sauron/finops/agent-matrix.js` | Core/Cline agent çözümleme, settings sync |
| Optimizer config | `OpenGuider-main/src/sauron/finops/cost-optimizer-config.js` | Tier defaults, complexity hint |
| DeepSeek provider | `OpenGuider-main/src/ai/deepseek.js` | Native OpenAI-compatible API |
| Workspace sync | `OpenGuider-main/src/sauron/finops/workspace-config.js` | `costOptimizer.agentMatrix` yazar |
| Bridge router | `sauron-vscode-bridge/src/cost-optimizer/router.ts` | Handoff → Cline agent |
| Bridge apply | `sauron-vscode-bridge/src/cost-optimizer/apply.ts` | `setActiveModel` before handoff |
| Bridge governor | `sauron-vscode-bridge/src/cost-optimizer/governor.ts` | Günlük bütçe → high OpenAI bastır |
| Daily governor (Core) | `OpenGuider-main/src/sauron/finops/daily-budget-governor.js` | Handoff toast + suggested agent |
| Agent usage | `OpenGuider-main/src/sauron/finops/agent-usage.js` | Agent bazlı token/USD özeti |
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
        "cline": { "low": "deepseek", "medium": "deepseek", "high": "openai" }
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
- `tests/unit/agent-usage.test.js`
- `tests/unit/daily-budget-governor.test.js`
- `sauron-vscode-bridge/src/test/router.test.ts`
- `sauron-vscode-bridge/src/test/provider-mapper.test.ts`
- `cline-main/apps/vscode/src/test/cline-api.test.ts`
