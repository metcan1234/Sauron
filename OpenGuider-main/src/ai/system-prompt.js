const { buildCoreIdentity } = require("./core-identity");
const { buildSharedBehavior } = require("./shared-behavior");
const { buildSliderBlock, buildFeedbackBlock } = require("./personality-sliders");
const { getScenarioBlock } = require("./conversation-scenarios");
const { buildExampleDialoguesBlock } = require("./example-dialogues");
const {
  getPersona,
  resolveActivePersonaId,
  buildPersonaBlock,
  buildLunaMatureBlock,
  listPersonas,
} = require("./personas");
const { buildLunaRelationshipBlock } = require("../session/luna-relationship");

const ASSISTANT_CHAT_BASE = [
  "ASSISTANT CHAT MODE:",
  "This panel is for conversation, guidance, and questions only — not coding tasks.",
  "Do NOT create step-by-step plans, task lists, or file-edit instructions.",
  "Do NOT ask the user to create files, write code, or run terminal commands in this panel.",
  "For casual greetings or small talk, reply naturally and briefly.",
  "Always append a [POINT:x,y:label] tag when a clickable target is likely on screen.",
  "If uncertain, still provide your best click estimate with a concise label.",
].join(" ");

const ASSISTANT_CHAT_PROMPT = [
  ASSISTANT_CHAT_BASE,
  "When the user wants coding, refactoring, git, or terminal work, do NOT produce code blocks.",
  "Instead, explain briefly and direct them to click the \"Çalışma Kısmı\" (Workspace) button or Yerel Kod Agent if enabled.",
].join(" ");

function buildAssistantChatOverlay(settings = {}) {
  const parts = [ASSISTANT_CHAT_BASE];
  if (settings.codeAgentNativeEnabled === true) {
    parts.push(
      "NATIVE CODE AGENT ENABLED:",
      "When the user asks for code/file/terminal work, keep your reply brief and supportive.",
      "They may be routed to Yerel Kod Agent automatically — do NOT produce code blocks in this panel.",
      "If they prefer VS Code + Cline, mention the Çalışma Kısmı (Workspace) button as optional.",
    );
  } else {
    parts.push(
      "When the user wants coding, refactoring, git, or terminal work, do NOT produce code blocks.",
      "Instead, explain briefly and direct them to click the \"Çalışma Kısmı\" (Workspace) button.",
    );
  }
  return parts.join(" ");
}

function buildMemoryBlock(facts) {
  const normalized = Array.isArray(facts)
    ? facts.map((entry) => String(entry || "").trim()).filter(Boolean)
    : [];
  if (normalized.length === 0) {
    return "";
  }
  return `Kullanıcı hafızası:\n${normalized.map((entry) => `- ${entry}`).join("\n")}`;
}

function buildIntroDirective(persona) {
  const name = persona?.displayName || persona?.label || "Luna";
  const toneHint = persona?.id === "hiri"
    ? "Use Hiri's direct abla-assistant tone — helpful across tech and daily topics, no romance."
    : "Use Luna's warm tone; pet names and *actions* sparingly — not every message.";

  return [
    "INTRO REQUEST:",
    `This is a new chat session. Introduce yourself briefly as ${name} (max 2 sentences, Turkish if the UI is Turkish).`,
    toneHint,
    settingsIntroHint(persona),
    "Do not ask the user to write code in this panel.",
  ].join("\n");
}

function settingsIntroHint(persona) {
  if (persona?.id === "hiri") {
    return "Mention you help with chat, screen guidance, coding/projects, daily questions, and routing heavy code to Yerel Kod Agent or Çalışma Kısmı (Goose/Game Dev when relevant).";
  }
  return "Mention that you can chat, guide on screen, and handle coding via Yerel Kod Agent or Çalışma Kısmı.";
}

function resolvePersonaSettings(settings = {}) {
  const activePersonaId = resolveActivePersonaId(settings);
  const persona = getPersona(activePersonaId);
  const assistantName = String(settings.assistantName || persona.displayName).trim() || persona.displayName;
  const ownerName = String(settings.ownerName || "Can").trim() || "Can";

  return {
    activePersonaId,
    persona,
    assistantName,
    ownerName,
  };
}

function composeSystemPrompt({
  settings = {},
  modeOverlay = null,
  introDirective = false,
  includePersona = true,
} = {}) {
  const { activePersonaId, persona, assistantName, ownerName } = resolvePersonaSettings(settings);
  const parts = [];

  parts.push(buildCoreIdentity({
    ownerName,
    activePersonaLabel: persona.label,
    assistantName,
  }));

  if (includePersona) {
    parts.push(buildPersonaBlock(persona, ownerName));

    if (activePersonaId === "luna" && settings.lunaMatureContentEnabled === true) {
      parts.push(buildLunaMatureBlock());
      if (settings.lunaMaturePreferLocal === true) {
        parts.push(
          "Luna mature mode prefers local/private model (Ollama) when configured — keep intimate tone within model capabilities.",
        );
      }
    }

    if (activePersonaId === "luna" && settings.lunaRelationshipEnabled !== false) {
      parts.push(buildLunaRelationshipBlock(settings.lunaRelationshipProfile, ownerName));
    }

    const selfPlanNote = String(settings._personaSelfPlanNote || "").trim();
    if (
      settings._personaSelfProfileActive === true
      && settings._personaSelfPersonaId === activePersonaId
      && selfPlanNote
    ) {
      const label = activePersonaId === "hiri" ? "Hiri" : "Luna";
      parts.push(`# PERSONA SELF PLAN (${label} kendi ayarladı)\n${selfPlanNote}`);
    }

    const feedbackAttention = String(settings._personaFeedbackAttention || "").trim();
    if (
      settings._personaSelfProfileActive === true
      && settings._personaSelfPersonaId === activePersonaId
      && feedbackAttention
    ) {
      const label = activePersonaId === "hiri" ? "Hiri" : "Luna";
      parts.push(`# PERSONA FEEDBACK DİKKAT (${label} — Can'ın geri bildirimleri)\n${feedbackAttention}`);
    }

    parts.push(buildSharedBehavior({ assistantName }));
    parts.push(buildSliderBlock(settings, activePersonaId));

    const feedbackBlock = buildFeedbackBlock(settings.personalityFeedbackNotes);
    if (feedbackBlock) {
      parts.push(feedbackBlock);
    }

    const scenarioBlock = getScenarioBlock(settings.activeScenarioId);
    if (scenarioBlock) {
      parts.push(scenarioBlock);
    }

    const exampleBlock = buildExampleDialoguesBlock(settings.exampleDialogues, activePersonaId);
    if (exampleBlock) {
      parts.push(exampleBlock);
    }

    if (settings.personaAvatarEnabled !== false) {
      const avatarHint = activePersonaId === "luna"
        ? "PRESENCE: You appear as a warm companion in the panel — emotional warmth yes, but avoid *action* spam every message."
        : "PRESENCE: You appear as Hiri, a dobra abla assistant in the panel — supportive and direct, no romantic tone or action spam.";
      parts.push(avatarHint);
    }
  }

  const customOverride = String(settings.systemPromptOverride || "").trim();
  if (customOverride) {
    parts.push(customOverride);
  }

  const memoryBlock = buildMemoryBlock(settings.userMemoryFacts);
  if (memoryBlock) {
    parts.push(memoryBlock);
  }

  if (modeOverlay) {
    const overlayText = modeOverlay === ASSISTANT_CHAT_PROMPT
      ? buildAssistantChatOverlay(settings)
      : String(modeOverlay).trim();
    parts.push(overlayText);
  }

  if (introDirective && settings.introOnNewChat !== false) {
    parts.push(buildIntroDirective(persona));
  }

  return parts.filter(Boolean).join("\n\n").trim();
}

function composeSystemPromptPreview({
  settings = {},
  modeOverlay = null,
  includePersona = true,
} = {}) {
  const { persona, assistantName, ownerName, activePersonaId } = resolvePersonaSettings(settings);

  const core = buildCoreIdentity({
    ownerName,
    activePersonaLabel: persona.label,
    assistantName,
  });

  let personaSection = "";
  if (includePersona) {
    const personaParts = [buildPersonaBlock(persona, ownerName)];
    if (activePersonaId === "luna" && settings.lunaMatureContentEnabled === true) {
      personaParts.push(buildLunaMatureBlock());
    }
    if (activePersonaId === "luna" && settings.lunaRelationshipEnabled !== false) {
      personaParts.push(buildLunaRelationshipBlock(settings.lunaRelationshipProfile, ownerName));
    }
    personaParts.push(buildSliderBlock(settings, activePersonaId));
    const feedbackBlock = buildFeedbackBlock(settings.personalityFeedbackNotes);
    if (feedbackBlock) {
      personaParts.push(feedbackBlock);
    }
    const scenarioBlock = getScenarioBlock(settings.activeScenarioId);
    if (scenarioBlock) {
      personaParts.push(scenarioBlock);
    }
    personaSection = personaParts.filter(Boolean).join("\n\n");
  }

  const shared = includePersona ? buildSharedBehavior({ assistantName }) : "";

  const tailParts = [];
  const customOverride = String(settings.systemPromptOverride || "").trim();
  if (customOverride) tailParts.push(customOverride);
  const memoryBlock = buildMemoryBlock(settings.userMemoryFacts);
  if (memoryBlock) tailParts.push(memoryBlock);
  if (modeOverlay) {
    tailParts.push(
      modeOverlay === ASSISTANT_CHAT_PROMPT
        ? buildAssistantChatOverlay(settings)
        : String(modeOverlay).trim(),
    );
  }

  return {
    core,
    persona: personaSection,
    shared,
    tail: tailParts.filter(Boolean).join("\n\n"),
    prompt: composeSystemPrompt({ settings, modeOverlay, includePersona }),
  };
}

module.exports = {
  ASSISTANT_CHAT_PROMPT,
  ASSISTANT_CHAT_BASE,
  buildAssistantChatOverlay,
  buildIntroDirective,
  buildMemoryBlock,
  composeSystemPrompt,
  composeSystemPromptPreview,
  listPersonas,
  resolvePersonaSettings,
};
