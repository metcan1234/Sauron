export function createPersonaAvatarController({ doc }) {
  const wrapEl = doc.getElementById("persona-avatar-wrap");
  const circleEl = doc.getElementById("persona-avatar-circle");
  const nameEl = doc.getElementById("persona-avatar-name");
  const moodEl = doc.getElementById("persona-avatar-mood");

  function render(settings = {}) {
    if (!wrapEl) {
      return;
    }
    if (settings.personaAvatarEnabled === false) {
      wrapEl.classList.add("hidden");
      return;
    }
    const personaId = settings.activePersonaId || "luna";
    const name = settings.assistantName || (personaId === "hiri" ? "Hiri" : "Luna");
    wrapEl.classList.remove("hidden");
    wrapEl.dataset.persona = personaId;
    if (circleEl) {
      circleEl.textContent = name.charAt(0).toUpperCase() || (personaId === "hiri" ? "H" : "L");
    }
    if (nameEl) {
      nameEl.textContent = name;
    }
    if (moodEl) {
      moodEl.textContent = personaId === "hiri" ? "Dobra abla modu" : "Yanındayım ♥";
    }
  }

  return { render };
}
