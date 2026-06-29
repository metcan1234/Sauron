# ADR-0001: Sauron Workspace Handoff Protocol

## Status
Accepted

## Context
Sauron Core must transfer task context to VS Code + Cline without duplicating full chat history.

## Decision
Use versioned JSON files under `{workspace}/.sauron/handoff-<id>.json` with compact `taskSummary`, `complexityHint`, and optional `costContext`.

## Consequences
Bridge watches `.sauron/` for pending files; terminal states use `.consumed` / `.rejected` suffixes.
