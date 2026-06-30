export async function runEnhancedOnboarding({ api, doc, settings }) {
  if (settings?.enhancedOnboardingEnabled === false) {
    return;
  }
  const listEl = doc.getElementById("onboarding-doctor-list");
  if (!listEl) {
    return;
  }
  try {
    const doctor = await api.invoke("run-sauron-doctor");
    const checks = Array.isArray(doctor?.checks) ? doctor.checks : [];
    if (!checks.length) {
      listEl.classList.add("hidden");
      return;
    }
    listEl.classList.remove("hidden");
    listEl.innerHTML = checks.map((check) => {
      const ok = check.status === "pass";
      const icon = ok ? "✓" : "✗";
      const cls = ok ? "doctor-pass" : "doctor-fail";
      const message = check.message || check.id || "";
      return `<li class="${cls}">${icon} ${message}</li>`;
    }).join("");
  } catch {
    listEl.classList.add("hidden");
  }
}
