# OpenGuider Installation and Usage Guide (EN)

This guide explains how to set up and use OpenGuider with a fully free-credit oriented provider combination for daily needs.

## 1) Target Free Setup Combination

- **AI Provider:** OpenRouter
- **Model:** `google/gemini-3.1-flash-image-preview` (fast and effective for visual context)
- **STT (Speech-to-Text):** Groq `whisper-large-v3-turbo`
- **TTS (Text-to-Speech):** ElevenLabs
  - Male Voice ID: `pNInz6obpgDQGcFmaJgB`
  - Female Voice ID: `EXAVITQu4vr4xnSDxMaL`

With this stack, free credits are usually enough for most daily usage scenarios. If credits run out, creating a new account can be a practical fallback.

---

## 2) Installation: Prepare the App

1. Open OpenGuider.
2. Go to the `Settings` screen.
3. Prepare API keys for:
   - OpenRouter
   - Groq
   - ElevenLabs

### 2.1 Get an OpenRouter API Key

1. Go to <https://openrouter.ai/>.
2. Create an account or sign in.
3. Open the Dashboard/Keys section.
4. Click `Create Key` and generate a new API key.
5. Copy the key and paste it into OpenGuider `Settings > AI Provider`.
6. Select `OpenRouter` as provider.
7. Choose `google/gemini-3.1-flash-image-preview` as the model.

### 2.2 Get a Groq API Key (STT)

1. Go to <https://console.groq.com/>.
2. Sign in and open the API keys page.
3. Create a new key and copy it.
4. In OpenGuider, paste it into `Settings > Voice > STT Provider`.
5. Select `whisper-large-v3-turbo` as STT model.

### 2.3 Get an ElevenLabs API Key (TTS)

1. Go to <https://elevenlabs.io/>.
2. Create an account/sign in.
3. Generate an API key from profile/API settings.
4. Paste it into OpenGuider `Settings > Voice > TTS Provider`.
5. Choose one of these voice IDs:
   - Male: `pNInz6obpgDQGcFmaJgB`
   - Female: `EXAVITQu4vr4xnSDxMaL`

---

## 3) Usage Guide: Best Practices

To avoid context bloat and quality drops, use these practices:

1. **One session, one main goal.**
   - Keep each session focused on a single clear task.
2. **Use short, objective prompts.**
   - Do not repeat unnecessary background in every message.
3. **Work step by step.**
   - Use clear transitions like "go to the next step".
4. **Provide fresh screen context.**
   - If UI changes, share a clear textual description.
5. **Request periodic summaries for long tasks.**
   - Ask "what have we done so far?" to keep context clean.
6. **Match model strength to task complexity.**
   - Daily quick tasks: flash model.
   - Critical planning: stronger model when needed.

### 3.1 Add Other Providers (Normal vs Recommended Usage)

To switch providers or add backup providers in OpenGuider:

1. Open `Settings > AI Provider`.
2. Select the provider you want to add.
3. Paste that provider's API key.
4. Pick a model and run a quick test prompt.
5. If quality drops, switch back to your main provider.

**Normal (budget-friendly) setup recommendation:**
- Default: OpenRouter + `google/gemini-3.1-flash-image-preview`
- STT: Groq `whisper-large-v3-turbo`
- TTS: ElevenLabs voice IDs
- Why: lower cost, fast responses, strong enough for daily tasks.

**Recommended (quality-focused) option:**
- For harder planning/analysis tasks, Claude Opus models usually produce stronger and more consistent outputs.
- But Claude Opus generally costs significantly more.
- Practical strategy:
  - Keep flash model for daily tasks.
  - Switch to Claude Opus only for critical/high-complexity steps.
  - Move back to low-cost model after the critical part is done.

---

## 4) Common Situations

- **If guidance is wrong/incomplete:**
  - Clarify the objective, describe current screen, provide fresh context.
- **If speech recognition is weak:**
  - Check microphone permissions and Groq key.
- **If TTS voice quality is not ideal:**
  - Try the other ElevenLabs voice ID.
- **If credits are exhausted:**
  - Continue with a new account based on your usage volume.
