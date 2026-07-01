export function createCodeAgentSummaryController({ doc, ui }) {
  const overlay = doc.getElementById("code-agent-summary-overlay");
  const titleEl = doc.getElementById("code-agent-summary-title");
  const bodyEl = doc.getElementById("code-agent-summary-body");
  const closeBtn = doc.getElementById("code-agent-summary-close");

  function hide() {
    overlay?.classList.add("hidden");
  }

  function show(payload = {}) {
    if (!overlay || !bodyEl) {
      ui.showToast(payload.summary || "Kod agent tamamlandı", false);
      return;
    }
    if (titleEl) {
      titleEl.textContent = payload.ok === false ? "Kod agent hatası" : "Kod agent özeti";
    }
    const lines = [
      payload.summary ? `Özet: ${payload.summary}` : "",
      payload.filesChanged ? `Dosyalar: ${payload.filesChanged}` : "",
      payload.tests ? `Test: ${payload.tests}` : "",
      payload.checkpointId ? `Checkpoint: ${payload.checkpointId}` : "",
      payload.error ? `Hata: ${payload.error}` : "",
    ].filter(Boolean);
    bodyEl.textContent = lines.join("\n") || "Görev tamamlandı.";
    overlay.classList.remove("hidden");
  }

  closeBtn?.addEventListener("click", hide);
  overlay?.addEventListener("click", (event) => {
    if (event.target === overlay) {
      hide();
    }
  });

  return { show, hide };
}
