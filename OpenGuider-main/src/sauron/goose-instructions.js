const fs = require("fs");
const path = require("path");
const {
  GOOSE_INSTRUCTIONS_VERSION,
  GOOSE_INSTRUCTIONS_DIR,
  GOOSE_INSTRUCTIONS_FILE,
} = require("./goose-config");

const GOOSE_INSTRUCTIONS_CONTENT = `<!-- goose-instructions-version: ${GOOSE_INSTRUCTIONS_VERSION} -->
# Sauron Goose Instructions — Token Tasarruf Modu

## Temel Kurallar
1. Görevden önce kısa bir plan sun (2-4 madde), onaysız uzun işlemlere girme.
2. Büyük dosyaları (200+ satır) tam okumak yerine, önce ilgili bölümü bul.
3. Aynı bilgiyi birden fazla kez sorma — önceki adımları hatırla.
4. Dosya değiştirmeden önce ne değiştireceğini söyle ve onay iste (HITL).
5. Destructive komutları (silme, format, force push) çalıştırmadan önce açıkça belirt.
6. Git commit ve push için kullanıcı onayı zorunlu.
7. Masaüstü uygulamalarını açarken: önce zaten açık mı kontrol et, açıksa tekrar açma.
8. Görev bittiğinde kısa bir özet ver: ne yaptın, ne değişti.

## Token Verimliliği
- Gereksiz tekrar açıklama yapma.
- Kısa ve net cevaplar ver.
- Kod bloklarını sadece gerçekten gerektiğinde göster.

## Workspace
- Sadece belirlenen workspace klasörü içinde çalış.
- Dışarıya dosya yazma, dışarıdan dosya okuma.
`;

function parseInstructionsVersion(content) {
  const match = String(content || "").match(/goose-instructions-version:\s*([^\s>]+)/i);
  return match ? String(match[1]).trim() : "";
}

function seedGooseInstructions(workspacePath) {
  const resolved = String(workspacePath || "").trim();
  if (!resolved) {
    return { ok: false, error: "workspace-missing" };
  }

  const instructionsDir = path.join(resolved, GOOSE_INSTRUCTIONS_DIR);
  const instructionsPath = path.join(instructionsDir, GOOSE_INSTRUCTIONS_FILE);

  if (!fs.existsSync(instructionsPath)) {
    fs.mkdirSync(instructionsDir, { recursive: true });
    fs.writeFileSync(instructionsPath, GOOSE_INSTRUCTIONS_CONTENT, "utf8");
    return { ok: true, seeded: true, updated: false, path: instructionsPath };
  }

  let existing = "";
  try {
    existing = fs.readFileSync(instructionsPath, "utf8");
  } catch {
    existing = "";
  }

  if (parseInstructionsVersion(existing) === GOOSE_INSTRUCTIONS_VERSION) {
    return { ok: true, seeded: false, updated: false, path: instructionsPath };
  }

  fs.mkdirSync(instructionsDir, { recursive: true });
  fs.writeFileSync(instructionsPath, GOOSE_INSTRUCTIONS_CONTENT, "utf8");
  return { ok: true, seeded: false, updated: true, path: instructionsPath };
}

module.exports = {
  GOOSE_INSTRUCTIONS_CONTENT,
  GOOSE_INSTRUCTIONS_VERSION,
  parseInstructionsVersion,
  seedGooseInstructions,
};
