function buildExampleDialoguesBlock(notes, personaId = "luna") {
  const normalized = Array.isArray(notes)
    ? notes.map((entry) => String(entry || "").trim()).filter(Boolean)
    : [];
  if (normalized.length === 0) {
    return "";
  }
  return [
    `# Örnek diyaloglar (${personaId === "hiri" ? "Hiri" : "Luna"} — kullanıcı tanımlı)`,
    "Bu örnekler ton rehberi olarak kullanılır; kelimesi kelimesine tekrar etme.",
    ...normalized.map((entry) => `- ${entry}`),
  ].join("\n");
}

module.exports = {
  buildExampleDialoguesBlock,
};
