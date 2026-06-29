# ADR-0004: Cost Optimizer and Agent Matrix

## Status
Accepted

## Context
Different operations (chat, planning, browser-goal, handoff) need tier-aware model routing.

## Decision
`prepareLlmCall` applies agent-matrix overlays unless operation is in the skip set; settings expose tier and optimizer mode.

## Consequences
Centralized pre-call hook for budget checks and model selection; browser plugin uses `browser-goal` operation.
