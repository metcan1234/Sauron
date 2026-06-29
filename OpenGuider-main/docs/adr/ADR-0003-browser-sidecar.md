# ADR-0003: Browser Plugin Sidecar Architecture

## Status
Accepted

## Context
Browser automation requires Python `browser-use` while the desktop shell is Electron/Node.

## Decision
Run a localhost FastAPI sidecar (`agent_server.py`) started by `Sidecar`; Node `BrowserBridge` is the only caller.

## Consequences
Renderer never talks to Python directly; usage metadata returns through bridge responses for FinOps.
