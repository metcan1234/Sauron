# ADR-0002: Unified FinOps Usage Ledger

## Status
Accepted

## Context
Core LLM calls and Cline task metrics must share one spend view.

## Decision
Append JSONL records to `{workspace}/.sauron/usage/logs.jsonl` with `operation`, tokens, and `costTl`.

## Consequences
Settings FinOps tab and header badge read the same ledger; bridge imports Cline exports into the file.
