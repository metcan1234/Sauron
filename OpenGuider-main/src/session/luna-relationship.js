const STAGE_LABELS = {
  new: "Tanışıyoruz",
  warming: "Isınıyoruz",
  close: "Yakınız",
  deep: "Derin",
};

const MAX_ABOUT_USER = 24;
const MAX_ABOUT_US = 16;
const MAX_SELF_NOTES = 12;
const MAX_MILESTONES = 20;

function emptyProfile() {
  return {
    stage: "new",
    messageCount: 0,
    firstSeenAt: "",
    lastMessageAt: "",
    aboutUser: [],
    aboutUs: [],
    lunaSelfNotes: [],
    milestones: [],
  };
}

function normalizeStringList(list, max = 24) {
  if (!Array.isArray(list)) {
    return [];
  }
  const seen = new Set();
  const result = [];
  for (const entry of list) {
    const line = String(entry || "").trim();
    if (!line) continue;
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(line);
  }
  return result.slice(-max);
}

function normalizeProfile(raw = {}) {
  const base = emptyProfile();
  const source = raw && typeof raw === "object" ? raw : {};
  return {
    stage: STAGE_LABELS[source.stage] ? source.stage : "new",
    messageCount: Math.max(0, Number(source.messageCount) || 0),
    firstSeenAt: String(source.firstSeenAt || "").trim(),
    lastMessageAt: String(source.lastMessageAt || "").trim(),
    aboutUser: normalizeStringList(source.aboutUser, MAX_ABOUT_USER),
    aboutUs: normalizeStringList(source.aboutUs, MAX_ABOUT_US),
    lunaSelfNotes: normalizeStringList(source.lunaSelfNotes, MAX_SELF_NOTES),
    milestones: Array.isArray(source.milestones)
      ? source.milestones.slice(-MAX_MILESTONES).map((entry) => ({
        id: String(entry?.id || "").trim() || `m-${Date.now()}`,
        at: String(entry?.at || "").trim(),
        label: String(entry?.label || "").trim(),
      })).filter((entry) => entry.label)
      : [],
  };
}

function computeRelationshipStage(profile = {}) {
  const count = Math.max(0, Number(profile.messageCount) || 0);
  const userFacts = (profile.aboutUser || []).length;
  const usFacts = (profile.aboutUs || []).length;

  if (count >= 150 || userFacts >= 15 || usFacts >= 8) {
    return "deep";
  }
  if (count >= 60 || userFacts >= 8 || usFacts >= 4) {
    return "close";
  }
  if (count >= 20 || userFacts >= 3) {
    return "warming";
  }
  return "new";
}

function getStageGuidance(stage = "new") {
  const map = {
    new: [
      "Evre: tanışma — daha çok soru sor, merak et, az hitap kullan.",
      "Henüz 'biz' dili kurma; samimi ama yeni tanışan çift gibi davran.",
    ],
    warming: [
      "Evre: ısınma — ara sıra sevgi sözcükleri; geçmişe doğal atıf yap.",
      "Can'ın tercihlerini hatırla ve soruların ona özel olsun.",
    ],
    close: [
      "Evre: yakınlık — doğal sevgi dili, inside joke, 'biz' hissi.",
      "Rutinleri ve tekrar eden konuları hatırla; tanışık çift gibi konuş.",
    ],
    deep: [
      "Evre: derin — günlük hayat takibi, hafif sitem normal, güven hissi.",
      "Uzun süreli hafızayı kullan; uydurma — listede yoksa sor.",
    ],
  };
  return map[stage] || map.new;
}

function mergeRelationshipLists(existing = [], incoming = [], max = 24) {
  return normalizeStringList([...(existing || []), ...(incoming || [])], max);
}

function recordLunaMessage(profile = {}) {
  const normalized = normalizeProfile(profile);
  const now = new Date().toISOString();
  if (!normalized.firstSeenAt) {
    normalized.firstSeenAt = now;
  }
  normalized.lastMessageAt = now;
  normalized.messageCount += 1;
  const previousStage = normalized.stage;
  normalized.stage = computeRelationshipStage(normalized);

  const milestones = [...normalized.milestones];
  if (previousStage !== normalized.stage) {
    milestones.push({
      id: `stage-${normalized.stage}-${Date.now()}`,
      at: now,
      label: `Evre: ${STAGE_LABELS[normalized.stage] || normalized.stage}`,
    });
  }
  normalized.milestones = milestones.slice(-MAX_MILESTONES);
  return normalized;
}

function applyRelationshipExtraction(profile = {}, extraction = {}) {
  const normalized = normalizeProfile(profile);
  if (Array.isArray(extraction.aboutUser) && extraction.aboutUser.length) {
    normalized.aboutUser = mergeRelationshipLists(normalized.aboutUser, extraction.aboutUser, MAX_ABOUT_USER);
  }
  if (Array.isArray(extraction.aboutUs) && extraction.aboutUs.length) {
    normalized.aboutUs = mergeRelationshipLists(normalized.aboutUs, extraction.aboutUs, MAX_ABOUT_US);
  }
  if (Array.isArray(extraction.lunaSelfNotes) && extraction.lunaSelfNotes.length) {
    normalized.lunaSelfNotes = mergeRelationshipLists(
      normalized.lunaSelfNotes,
      extraction.lunaSelfNotes,
      MAX_SELF_NOTES,
    );
  }
  normalized.stage = computeRelationshipStage(normalized);
  return normalized;
}

function formatHoursSince(isoDate = "") {
  const parsed = Date.parse(isoDate);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  const hours = Math.floor((Date.now() - parsed) / (1000 * 60 * 60));
  if (hours < 1) return "az önce";
  if (hours < 24) return `${hours} saat önce`;
  const days = Math.floor(hours / 24);
  return `${days} gün önce`;
}

function buildLunaRelationshipBlock(profile = {}, ownerName = "Can") {
  const normalized = normalizeProfile(profile);
  const owner = String(ownerName || "Can").trim() || "Can";
  const lines = [
    "# LUNA — İLİŞKİ HAFIZASI (konuştukça tanıma)",
    "",
    `Tanışıklık evresi: ${STAGE_LABELS[normalized.stage] || normalized.stage} (${normalized.messageCount} mesaj).`,
    ...getStageGuidance(normalized.stage),
    "",
    "Kurallar:",
    "- Store'daki gerçekleri kullan; listede yoksa uydurma — 'tam hatırlamıyorum, anlatır mısın?' de.",
    "- Her mesajda en fazla bir anlamlı soru sor; soru spam yapma.",
    "- Karşılıklı muhabbet kur; tek taraflı sevgi monologu değil.",
  ];

  const lastGap = formatHoursSince(normalized.lastMessageAt);
  if (lastGap && normalized.messageCount > 5) {
    lines.push(`Son mesaj: ${lastGap} — uzun ara olduysa doğal şekilde sorabilirsin.`);
  }

  if (normalized.aboutUser.length) {
    lines.push("", `${owner} hakkında bildiklerin:`);
    normalized.aboutUser.slice(-10).forEach((fact) => lines.push(`- ${fact}`));
  }
  if (normalized.aboutUs.length) {
    lines.push("", "Birlikte / 'biz' hakkında:");
    normalized.aboutUs.slice(-8).forEach((fact) => lines.push(`- ${fact}`));
  }
  if (normalized.lunaSelfNotes.length) {
    lines.push("", "Luna'nın tutarlı kendi notları (bunları sürdür):");
    normalized.lunaSelfNotes.slice(-6).forEach((fact) => lines.push(`- ${fact}`));
  }

  return lines.join("\n");
}

function getLunaRelationshipState(settings = {}) {
  const enabled = settings.lunaRelationshipEnabled !== false
    && String(settings.activePersonaId || "luna") === "luna";
  const profile = normalizeProfile(settings.lunaRelationshipProfile || emptyProfile());
  return {
    enabled,
    profile,
    stage: profile.stage,
    label: STAGE_LABELS[profile.stage] || profile.stage,
    messageCount: profile.messageCount,
  };
}

module.exports = {
  STAGE_LABELS,
  emptyProfile,
  normalizeProfile,
  computeRelationshipStage,
  recordLunaMessage,
  applyRelationshipExtraction,
  buildLunaRelationshipBlock,
  getLunaRelationshipState,
  mergeRelationshipLists,
};
