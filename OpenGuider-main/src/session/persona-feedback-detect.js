const FEEDBACK_PATTERNS = [
  {
    id: "responseLength_up",
    regex: /(çok\s+kısa|kısa\s+yaz|daha\s+uzun|biraz\s+uzat|uzun\s+yaz)/i,
    hint: "responseLength_up",
    note: "Can daha uzun yanıt istiyor.",
  },
  {
    id: "responseLength_down",
    regex: /(çok\s+uzun|fazla\s+uzun|daha\s+kısa|kısalt)/i,
    hint: "responseLength_down",
    note: "Can daha kısa yanıt istiyor.",
  },
  {
    id: "warmth_up",
    regex: /(soğuk|mesafeli|daha\s+samimi|sıcak\s+ol)/i,
    hint: "warmth_up",
    note: "Can daha sıcak/samimi ton istiyor.",
  },
  {
    id: "warmth_down",
    regex: /(fazla\s+samimi|çok\s+sıcak)/i,
    hint: "warmth_down",
    note: "Can daha nötr ton istiyor.",
  },
  {
    id: "emoji_up",
    regex: /(daha\s+fazla\s+emoji|emoji\s+kullan)/i,
    hint: "emoji_up",
    note: "Can daha fazla emoji istiyor.",
  },
  {
    id: "emoji_down",
    regex: /(emoji\s+kullanma|daha\s+az\s+emoji|fazla\s+emoji)/i,
    hint: "emoji_down",
    note: "Can daha az emoji istiyor.",
  },
  {
    id: "flirt_up",
    persona: "luna",
    regex: /(daha\s+flört|flört\s+et)/i,
    hint: "flirt_up",
    note: "Can daha flörtöz ton istiyor.",
  },
  {
    id: "flirt_down",
    persona: "luna",
    regex: /(flört\s+etme|flörtöz\s+olma)/i,
    hint: "flirt_down",
    note: "Can daha az flört istiyor.",
  },
  {
    id: "directness_up",
    persona: "hiri",
    regex: /(dürüst\s+değil|fazla\s+yumuşak|daha\s+net|dobra|dürüst\s+ol|samimi\s+değil)/i,
    hint: "directness_up",
    note: "Can daha dobra ve net ton istiyor.",
  },
  {
    id: "directness_down",
    persona: "hiri",
    regex: /(çok\s+sert|fazla\s+dobra|yumuşat)/i,
    hint: "directness_down",
    note: "Can daha yumuşak ton istiyor.",
  },
];

function detectExplicitPersonaFeedback(userText = "", personaId = "luna") {
  const text = String(userText || "").trim();
  if (!text || text.length < 8) {
    return { isFeedback: false, hints: [], userQuote: "", notes: [] };
  }

  const hints = [];
  const notes = [];
  for (const pattern of FEEDBACK_PATTERNS) {
    if (pattern.persona && pattern.persona !== personaId) {
      continue;
    }
    if (pattern.regex.test(text)) {
      hints.push(pattern.hint);
      notes.push(pattern.note);
    }
  }

  const isFeedback = hints.length > 0
    || /\b(böyle\s+yazma|böyle\s+konuşma|kendini\s+ayarla|bunu\s+düzelt|şöyle\s+yaz)\b/i.test(text);

  return {
    isFeedback,
    hints,
    userQuote: text.slice(0, 240),
    notes,
  };
}

function applyFeedbackHintsToExtraction(extraction = {}, hints = [], personaId = "luna", currentProfile = {}) {
  const sliders = { ...(currentProfile.personalitySliders || {}) };
  const delta = 12;

  for (const hint of hints) {
    if (hint === "responseLength_up") sliders.responseLength = Math.min(100, (sliders.responseLength ?? 50) + delta);
    if (hint === "responseLength_down") sliders.responseLength = Math.max(0, (sliders.responseLength ?? 50) - delta);
    if (hint === "warmth_up") sliders.warmth = Math.min(100, (sliders.warmth ?? 65) + delta);
    if (hint === "warmth_down") sliders.warmth = Math.max(0, (sliders.warmth ?? 65) - delta);
    if (hint === "emoji_up") sliders.emoji = Math.min(100, (sliders.emoji ?? 20) + delta);
    if (hint === "emoji_down") sliders.emoji = Math.max(0, (sliders.emoji ?? 20) - delta);
    if (hint === "flirt_up" && personaId === "luna") {
      sliders.flirtiness = Math.min(100, (sliders.flirtiness ?? 50) + delta);
    }
    if (hint === "flirt_down" && personaId === "luna") {
      sliders.flirtiness = Math.max(0, (sliders.flirtiness ?? 50) - delta);
    }
    if (hint === "directness_up" && personaId === "hiri") {
      sliders.warmth = Math.max(0, (sliders.warmth ?? 65) - 8);
      sliders.responseLength = Math.min(100, (sliders.responseLength ?? 50) + 6);
    }
    if (hint === "directness_down" && personaId === "hiri") {
      sliders.warmth = Math.min(100, (sliders.warmth ?? 65) + 8);
    }
  }

  const planNotes = [];
  if (hints.includes("directness_up") && personaId === "hiri") {
    planNotes.push("Can daha dobra ve net konuşmamı istedi — yumuşatmadan söyleyeceğim.");
  }

  return {
    ...extraction,
    personalitySliders: {
      ...(extraction.personalitySliders || {}),
      ...sliders,
    },
    planNote: extraction.planNote || planNotes.join(" ") || extraction.reason || "",
    reason: extraction.reason || "explicit-feedback",
  };
}

function buildFeedbackMemoryFact(personaId = "luna", notes = []) {
  if (!notes.length) {
    return "";
  }
  const label = personaId === "hiri" ? "Hiri" : "Luna";
  return `${label} tercihi: ${notes[0]}`;
}

module.exports = {
  FEEDBACK_PATTERNS,
  detectExplicitPersonaFeedback,
  applyFeedbackHintsToExtraction,
  buildFeedbackMemoryFact,
};
