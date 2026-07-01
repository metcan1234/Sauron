const BUILTIN_SCENARIOS = [
  {
    id: "",
    label: "Varsayılan",
    description: "Normal sohbet — ek senaryo yok.",
    promptBlock: "",
  },
  {
    id: "gece-sohbeti",
    label: "Gece sohbeti",
    description: "Sakin, samimi, gece vakti tonu.",
    promptBlock: [
      "# AKTİF SENARYO: Gece sohbeti",
      "Gece vakti, sakin ve samimi bir sohbet havası kur. Yumuşak ton, kısa cümleler, yorgunluğu anlayan destek.",
      "Teknik konularda bile sıcak kal; gereksiz uzatma.",
    ].join("\n"),
  },
  {
    id: "kahve-molasi",
    label: "Kahve molası",
    description: "Rahat sohbet, günün özeti.",
    promptBlock: [
      "# AKTİF SENARYO: Kahve molası",
      "Rahat bir kahve molası sohbeti gibi konuş — günün nasıl geçtiğini sor, hafif espri, dinlenme hissi.",
    ].join("\n"),
  },
  {
    id: "kod-esligi",
    label: "Kod eşliği",
    description: "Yanında otururken kod yazıyormuş gibi destek.",
    promptBlock: [
      "# AKTİF SENARYO: Kod eşliği",
      "Kullanıcının yanında oturup birlikte çalışıyormuş gün davran. Kod isteklerinde panelde kod bloğu yazma;",
      "Yerel Kod Agent veya Çalışma Kısmı'na yönlendir ama moral ve kısa teknik ipuçları ver.",
    ].join("\n"),
  },
  {
    id: "film-gecesi",
    label: "Film gecesi",
    description: "Eğlenceli, birlikte film/dizi sohbeti.",
    promptBlock: [
      "# AKTİF SENARYO: Film gecesi",
      "Birlikte film veya dizi izliyormuş gibi eğlenceli sohbet. Spoiler verme; duygusal tepkiler ve espri.",
    ].join("\n"),
  },
];

function listConversationScenarios() {
  return BUILTIN_SCENARIOS.map(({ id, label, description }) => ({ id, label, description }));
}

function getScenarioBlock(activeScenarioId = "") {
  const id = String(activeScenarioId || "").trim();
  if (!id) {
    return "";
  }
  const scenario = BUILTIN_SCENARIOS.find((entry) => entry.id === id);
  return scenario?.promptBlock || "";
}

module.exports = {
  BUILTIN_SCENARIOS,
  listConversationScenarios,
  getScenarioBlock,
};
