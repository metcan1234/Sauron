# ADR-0005: Hard Budget Enforcement

## Status
Accepted

## Context
Soft budget alerts warn but still allow spend; some users need a hard stop.

## Decision
When `finopsHardBudgetEnabled` is true and total spend exceeds `finopsTotalBudgetTl`, `prepareLlmCall` throws `BudgetExceededError`.

## Consequences
Chat stream path surfaces a user-visible message; browser and other callers should handle the error consistently.
