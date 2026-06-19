# Sauron

Download from [GitHub Releases](https://github.com/metcan1234/Sauron/releases/latest)



<p align="center">
  <img src="./renderer/assets/logo.png" alt="Sauron logo" width="150">
</p>

![Release Build](https://img.shields.io/github/actions/workflow/status/metcan1234/Sauron/release-build.yml?label=release%20build)
![Tests](https://img.shields.io/github/actions/workflow/status/metcan1234/Sauron/multi-platform-test.yml?branch=main&label=tests)
![Latest Release](https://img.shields.io/github/v/release/metcan1234/Sauron?label=latest%20release)
![License](https://img.shields.io/github/license/metcan1234/Sauron)

Sauron is an Electron desktop AI assistant designed to help you complete real UI tasks on your machine.

It combines chat, planning, screenshot context, pointer hints, optional voice features, and a growing plugin system in one desktop workflow.

## Quick Configuration Guides (PDF)

- Turkish guide: [OpenGuider - Configuration (TR)](https://mo-tunn.github.io/OpenGuider/docs/OpenGuider%20-%20Configuration%28TR%29.pdf)
- English guide: [OpenGuider - Configuration (EN)](https://mo-tunn.github.io/OpenGuider/docs/OpenGuider%20-%20Configuration%20%28EN%29%20.pdf)

## What Sauron Does

- Converts your goal into a step-by-step execution plan.
- Uses screenshot context to reason about what is currently on screen.
- Gives coordinate-based pointer guidance for "click here" style help.
- Routes compatible tasks into plugins when a specialized workspace is available.
- Keeps session history so long tasks remain coherent across messages.
- Supports multiple model providers so you can switch based on speed/cost/quality.
- Adds optional speech-to-text and text-to-speech for hands-free usage.

## v1.0 Highlights

- **Chat UX:** Edit/delete messages, regenerate, drag-drop attachments, chat folders
- **Artifacts:** Side panel for code blocks (open, edit, copy, download)
- **Persona & memory:** Custom system prompt and per-line user memory facts in Settings
- **Local backup:** Export/import all chat sessions as JSON (auto backup on startup/shutdown)
- **FinOps:** Session vs total spend in the header badge
- **Stability:** Panel and Settings renderer crash recovery
- **Docs:** [Turkish user guide](docs/user-guide-tr.md) · [Manual test checklist](docs/MANUAL-TEST-CHECKLIST.md)

## Feature Breakdown

### 1) Multi-Provider AI Layer

Sauron supports:

- Claude
- OpenAI
- Gemini
- Groq
- OpenRouter
- Ollama (local)

Why this matters:

- You can optimize for latency, pricing, or reasoning quality per task.
- You can fail over to another provider if one API is unavailable.
- You can use local models (Ollama) for privacy-sensitive workflows.

### 2) Planning and Task Orchestration

Instead of only returning plain text responses, Sauron can:

- build a structured plan,
- track current step,
- replan when state changes,
- and continue until completion.

This makes the app useful for real multi-step operations, not just simple Q/A.

### 3) Screen-Aware Guidance

Sauron can reason with screenshot context to produce actionable guidance:

- identify likely UI regions,
- map instructions to on-screen targets,
- emit pointer hints with coordinates.

This is the core of "guide me while I use my apps" behavior.

### 4) Voice Input and Output

Speech-to-text options:

- AssemblyAI
- Whisper-compatible endpoints

Text-to-speech options:

- Google TTS
- OpenAI TTS
- ElevenLabs

You can run chat-only, voice-only, or hybrid flows depending on your setup.

### 5) Plugin System and Browser Automation

Sauron now has a plugin layer so specialized workspaces can plug into the desktop assistant over time.

Today, the first live plugin is the Browser plugin. It uses `browser-use` under the hood and can:

- open and navigate websites,
- fill forms and follow multi-step browser tasks,
- show live execution progress in the panel and widget,
- pause for approval on risky actions,
- or continue in autopilot mode when you want it to run automatically.

This matters because browser automation is now a feature inside a broader plugin system, not a one-off hardcoded mode. More plugins can be added later without changing the overall Sauron workflow.

## Live Preview

<p align="center">
  <img src="./tutorial.gif" alt="Sauron tutorial" width="360">
</p>

## Downloads

- Latest release: [https://github.com/metcan1234/Sauron/releases/latest](https://github.com/metcan1234/Sauron/releases/latest)
- Windows installer: `Sauron-{version}-win-x64.exe` (from release assets)

## Installation

### Option A: Download Prebuilt App (Recommended)

1. Open the latest release page: [https://github.com/metcan1234/Sauron/releases/latest](https://github.com/metcan1234/Sauron/releases/latest)
2. Download your platform artifact:
   - Windows: `Sauron-{version}-win-x64.exe`
3. Extract and run the app.
4. If you want browser automation, open `Settings -> Plugins`.
5. In the Browser plugin card, click `Download Runtime` once.
6. Choose whether browser tasks should run with approval or in autopilot mode.

### Option B: Run From Source

1. Install dependencies: `npm install`
2. Start the app: `npm run start`

## Configuration Guide (Detailed)

Open Settings in the app and configure in this order.

### Step 1: Choose Your Main LLM Provider

Pick one provider first (you can add others later):

- Claude / OpenAI / Gemini / Groq / OpenRouter / Ollama

Then set:

- provider API key (if required),
- default model,
- and any provider-specific endpoint fields.

Tip:

- Start with a single stable provider before enabling all options.

### Step 2: Select the Default Model

Choose a model based on your use case:

- Fast and cheap for short daily guidance.
- Stronger reasoning model for complex multi-step planning.
- Recommended default for daily usage: `google/gemini-3.1-flash-image-preview` (via OpenRouter).

If model output quality is inconsistent, switch to a more capable model.

### Step 3: Configure Voice (Optional)

If you want microphone-driven workflows:

1. Select your STT provider.
2. Set language options.
3. Verify system microphone permissions.
4. Run a short recognition test.

Practical low-cost default:

- STT provider: Groq
- STT model: `whisper-large-v3-turbo`

For spoken responses:

1. Select TTS provider.
2. Pick voice.
3. Test output volume and speaking speed.

Suggested ElevenLabs voice IDs:

- `pNInz6obpgDQGcFmaJgB` (male)
- `EXAVITQu4vr4xnSDxMaL` (female)

### Step 4: Validate the Setup

Send a simple prompt first, for example:

- "Open settings and guide me to configure notifications step by step."

Then try a planning-style prompt:

- "Help me complete this task in 5 steps and wait for confirmation after each step."

Then try a plugin-style prompt:

- "Search the web for the official OpenAI API docs and pause before opening any sign-in page."
- "Use the browser plugin to find a product page, but ask me before submitting or checking out."

### Step 5: Add Secondary Providers (Optional)

After your main provider works, add backups for reliability:

- Primary provider for default usage.
- Secondary provider for fallback.
- Local Ollama profile for offline/private runs.

## How To Use Sauron Effectively

For best results, write goals in this format:

- Context: what app/page you are in.
- Objective: what you want to complete.
- Constraints: things to avoid or mandatory requirements.

Good example:

- "I am in Figma settings. Help me enable autosave and version history safely. Give one step at a time and wait."

## Troubleshooting

- If the AI response is generic:
  - check selected model/provider,
  - include clearer UI context,
  - provide a fresh screenshot context by retrying the step.
- If voice does not work:
  - verify OS microphone permission,
  - verify API key for STT/TTS provider,
  - test with a shorter input phrase.
- If pointer hints are off:
  - capture a fresh screenshot and retry,
  - avoid heavily zoomed/scaled UI when possible.

## Security and Data Handling

Sauron is designed as a local-first desktop app. This section explains what data is stored, what may be sent to external providers, and how to operate safely.

### Data Stored Locally

- App settings (provider choices, model selection, preferences) are stored in the Electron `userData` directory.
- Session/task history is stored locally to keep multi-step context coherent.
- Logs are written locally for debugging and runtime diagnostics.
- API keys are stored with secure storage (`keytar`) when available; otherwise encrypted fallback storage is used.

### Data Sent to External Services

Depending on your configuration, Sauron may send:

- prompts and conversation context to your selected LLM provider,
- voice audio/text to selected STT/TTS providers,
- screenshot-derived context when screen-aware guidance is used.

Important:

- data is sent only to providers you explicitly configure,
- there is no hidden relay server by default between your app and providers.

### Screenshot and UI Context Handling

- Screenshots are used to improve on-screen guidance and step suggestions.
- For privacy-sensitive tasks, avoid including confidential content on screen before capture.
- If required by policy, disable screen-aware workflows and use text-only guidance.

### Operational Security Best Practices

- Use a dedicated provider API key for Sauron (do not reuse high-privilege keys).
- Rotate API keys periodically.
- Never commit `.env` or key files to Git.
- Prefer local model usage (Ollama) for highly sensitive workflows.
- Review logs before sharing them publicly in issues.

### Privacy and Compliance Notes

- Sauron is open-source, so security behavior is auditable.
- Compliance posture depends on your selected providers and their data policies.
- If your team has strict requirements, define an approved provider/model list and disable non-approved endpoints.

## Support and Contribution

If you want to support Sauron by contributing code, docs, tests, or design updates, this section is for you.

### Branching Strategy for Contributors

- `main`: stable branch used for production-ready updates.
- `feature/<short-name>`: new features.
- `fix/<short-name>`: bug fixes.
- `docs/<short-name>`: README/docs-only changes.
- `chore/<short-name>`: maintenance and tooling updates.

Examples:

- `feature/voice-hotkeys`
- `fix/linux-build-artifact`
- `docs/readme-configuration-guide`

### Recommended Contribution Flow

1. Fork the repository (or create a branch if you are a direct collaborator).
2. Create a new branch from `main`.
3. Keep commits focused and descriptive.
4. Run tests locally: `npm run test`.
5. Push your branch and open a Pull Request.

### Pull Request Checklist

- Explain what changed and why.
- Include test notes (what you ran and results).
- Add screenshots/GIF for UI changes.
- Keep scope small and review-friendly.
- Rebase/merge latest `main` if needed before final review.

### Ways to Help Beyond Code

- Improve docs and onboarding examples.
- Report reproducible bugs with logs/steps.
- Propose UX improvements for panel/widget flows.
- Help test releases on Windows/macOS/Linux.

## Development

- Run with inspector: `npm run dev`
- Run tests: `npm run test`
- Install Sauron stack (Bridge VSIX, prerequisites): `scripts/install-sauron-stack.ps1` (Windows PowerShell)
- Workspace health check: Settings → Workspace → **Sistem tanısı çalıştır** (or IPC `run-sauron-doctor`)

## Build Installers (Windows/macOS/Linux)

- Build all platform targets on your current OS: `npm run dist`
- Build only Windows NSIS installer (`.exe`): `npm run dist:win`
- Build only macOS installer (`.dmg`): `npm run dist:mac`
- Build only Linux packages (`.AppImage` + `.deb`): `npm run dist:linux`
- Output artifacts are written to `release/`

## Architecture

```mermaid
flowchart LR
  User[User]
  UI[Renderer UI\nPanel + Widget + Settings]
  Preload[preload.js\nSecure IPC Bridge]
  Main[main.js\nElectron Main Process]
  Agent[src/agent/*\nPlanner + Orchestrator]
  AI[src/ai/*\nProvider Clients]
  Plugins[src/plugins/*\nPlugin Registry + Browser Plugin]
  Session[src/session/*\nSession State + Persistence]
  Screen[src/screenshot.js\nScreen Capture]
  Voice[src/tts/* + STT adapters]

  User --> UI
  UI --> Preload
  Preload --> Main
  Main --> Agent
  Agent --> AI
  Main --> Plugins
  Agent --> Plugins
  Agent <--> Session
  Main --> Screen
  Main --> Voice
  Agent --> UI
```

### Component Roles

- `main.js`: app lifecycle, tray/shortcuts, IPC routing, orchestration entrypoint.
- `preload.js`: secure boundary between renderer and main process APIs.
- `renderer/*`: user-facing UI surfaces (panel, widget, settings, cursor overlay).
- `src/agent/*`: planning, evaluation, replanning, and task progression logic.
- `src/ai/*`: model-provider abstractions and structured response handling.
- `src/plugins/*`: plugin registry plus specialized execution surfaces such as the Browser plugin.
- `src/session/*`: session model, history continuity, state persistence.

## Security Notes

- API keys are persisted via OS-protected secure storage (`keytar`) when available.
- If keychain is unavailable, encrypted fallback storage is used through Electron safe storage.
- Renderer runs with `contextIsolation: true` and `nodeIntegration: false`.
- Application data is stored in Electron `userData` path under a stable app identity (`Sauron`) so updates keep local settings/history.

## GitHub Release Automation

1. Push a semantic version tag (example: `v0.2.0`).
2. GitHub Actions runs `.github/workflows/release-build.yml`.
3. Installers are attached to the release:
   - `Sauron-{version}-win-x64.exe`

## License

This project is licensed under the Apache License 2.0.  
See [`LICENSE`](./LICENSE) for full terms.

Copyright (C) Metehan Kızılcık

If you create a derivative project, keep these Apache 2.0 basics:

1. Include the full Apache 2.0 license text in a `LICENSE` file.
2. Keep copyright notices (including `Metehan Kızılcık`).
3. Mark significant modifications clearly in changed files.

## Acknowledgement

Sauron was originally inspired by Clicky.
