# Sauron Game Dev Roadmap (FAZ 3–7)

## Shipped in v2.1.0

### Production auto-chain
- `advanceGamePipelineAfterComplete` + `writeGamedevPhaseHandoff`
- UI `refreshGamePipeline` polling (build-pipeline parity)
- MCP verification gate (`unity_play_mode`, skip when bridge offline)

### Playable scaffold
- `templates/unity/_shared/` — Main.unity, Editor bootstrap, asset stubs
- Genre scenes copied to `Assets/SauronGameDev/{genre}/Scenes/`
- `scripts/scaffold-unity-template.js` CLI

### MCP extension (+7 tools)
- `unity-script`: set/edit/grep scripts
- `unity-scene`: save/load scene, save/instantiate prefab
- FinOps ledger hook via `SAURON_GAMEDEV_WORKSPACE`

### Token economy v2.1
- Phase-based 0-token plan bullets
- Wire recipe pointers (no JSON in handoff body)
- Hierarchy snapshot in scene cache (bounded)
- Honest `mcp-tool` ledger (no fake launch log)

## Shipped in v2.0.0

### FAZ 3 — Game Pipeline
- `game-pipeline/` registry, planner, state (`.sauron/game-pipeline.json`), runner
- Pipelines: `unity-empty-v1`, `unity-co-op-climb-v1`, `unity-horror-coop-v1`, `unity-social-deduction-v1`
- IPC: `list-game-pipelines`, `start-game-pipeline`, `advance-game-pipeline`, `get-game-pipeline-status`
- Auto-chain via `gamedevPipelineAutoChain` + `cline-task-complete.json`

### FAZ 4 — Unity Templates
- `templates/unity/co-op-climb`, `horror-coop`, `social-deduction`
- `scripts/scaffold-unity-template.js` + `src/sauron/scaffold-unity-template.js`
- Genre-specific `.clinerules/sauron-game-{genre}.md`

### FAZ 6 — Game Studio UX
- Template picker, pipeline bar, dashboard link
- First-run `gamedev-setup-overlay` wizard
- Settings: `gamedevDefaultTemplate`, `gamedevPipelineAutoChain`

### FAZ 7 (v1 skeleton) — Multiplayer
- Netcode for GameObjects bootstrap scripts in each template (4p / 12p)
- URP + Netcode packages merged into `Packages/manifest.json` on scaffold

## Token economy (preserved)

- `mcpTools: "full"` — never restrict MCP tools for economy
- 0-token `buildGameDevPlanBullets` per phase
- Scene cache pointer only (no workspace tree in handoff)
- `includeTranscript: false`, `complexityHint: "low"`
- Optional LLM plan must use `game-dev-plan` FinOps operation

## Deferred (v2.1+)

### FAZ 5 — Unreal
- `unreal-arena-v1` placeholder only; engine UI shows "yakında"

### FAZ 7 long-term
- Steam lobby (Steamworks.NET)
- Full proximity voice chat integration
- Procedural world streaming at scale
- AAA polish pipelines

## Genre mapping (examples, not clones)

| User intent | Pipeline | Template |
|-------------|----------|----------|
| PEAK-like climb | `unity-co-op-climb-v1` | `co-op-climb` |
| Zort-like horror | `unity-horror-coop-v1` | `horror-coop` |
| Feign-like social | `unity-social-deduction-v1` | `social-deduction` |
