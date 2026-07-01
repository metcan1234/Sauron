export function getPersonaCodeStartMessage(settings = {}) {
  const personaId = settings.activePersonaId || "luna";
  if (personaId === "hiri") {
    return "Can, görevi yerel kod agent'a verdim. VS Code açmana gerek yok — bitince raporlayacağım.";
  }
  return "*Gülümseyerek sana bakıyorum* Tamam aşkım, kodunu yerel agent'la hallediyorum — biraz bekle yakışıklım.";
}

export function getPersonaCodeCompleteMessage(settings = {}, summary = "") {
  const personaId = settings.activePersonaId || "luna";
  const tail = String(summary || "").trim();
  if (personaId === "hiri") {
    return tail ? `Bitti Can. Özet: ${tail}` : "Bitti Can. Kod agent görevi tamamladı.";
  }
  return tail
    ? `*Kocaman gülümsüyorum* İşte bu aşkım! ${tail}`
    : "*Sana sarılıyorum* Kod agent görevi tamamladı sevgilim.";
}

export function getPersonaCodeErrorMessage(settings = {}, error = "") {
  const personaId = settings.activePersonaId || "luna";
  const tail = String(error || "bilinmeyen hata").trim();
  if (personaId === "hiri") {
    return `Can, kod agent takıldı: ${tail}. Ayarlardan API key ve workspace'i kontrol et.`;
  }
  return `*Endişeyle* Ah sevgilim, bir şey ters gitti: ${tail}. Birlikte ayarlara bakalım mı?`;
}

export async function pickIntroGreeting(api, config) {
  const customIntro = String(config.customIntroMessage || "").trim();
  if (customIntro) {
    return customIntro;
  }

  const altFromSettings = Array.isArray(config.altGreetings)
    ? config.altGreetings.map((line) => String(line || "").trim()).filter(Boolean)
    : [];

  let defaultGreeting = "";
  try {
    const personas = await api.invoke("get-personas");
    const activeId = config.activePersonaId || "luna";
    const persona = (personas || []).find((entry) => entry.id === activeId);
    defaultGreeting = String(persona?.defaultGreeting || "").trim();
  } catch {
    defaultGreeting = "";
  }

  const pool = [...altFromSettings];
  if (defaultGreeting) {
    pool.push(defaultGreeting);
  }
  if (pool.length === 0) {
    return "";
  }
  return pool[Math.floor(Math.random() * pool.length)];
}
