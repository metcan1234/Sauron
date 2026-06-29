export function createSelfBuildStudioController({ api, ui, doc }) {
  let currentStep = 0;
  const overlay = doc.getElementById("self-build-overlay");
  const steps = Array.from(doc.querySelectorAll("[data-sbs-step]"));
  const summaryEl = doc.getElementById("sbs-summary");

  function showStep(step) {
    currentStep = Math.max(0, Math.min(step, steps.length - 1));
    steps.forEach((el) => {
      const idx = Number(el.getAttribute("data-sbs-step"));
      el.classList.toggle("hidden", idx !== currentStep);
    });
    doc.getElementById("sbs-btn-back")?.classList.toggle("hidden", currentStep === 0);
    doc.getElementById("sbs-btn-next")?.classList.toggle("hidden", currentStep === steps.length - 1);
    doc.getElementById("sbs-btn-finish")?.classList.toggle("hidden", currentStep !== steps.length - 1);
    if (currentStep === steps.length - 1) {
      void refreshSummary();
    }
  }

  async function refreshSummary() {
    const pipelineId = doc.getElementById("sbs-pipeline-id")?.value || "self-improve-feature-v1";
    const taskDescription = doc.getElementById("sbs-task-description")?.value?.trim() || "";
    const costProfile = doc.getElementById("sbs-cost-profile")?.value || "balanced";
    try {
      const plan = await api.invoke("plan-build-pipeline", {
        pipelineId,
        options: { taskDescription, costProfile },
      });
      if (!plan?.ok || !summaryEl) {
        return;
      }
      const p = plan.pipeline;
      summaryEl.innerHTML = [
        `<strong>${p.label}</strong>`,
        `Faz sayısı: ${p.totalPhases}`,
        `Tahmini maliyet: ~${p.totalEstimatedCostTl} TL`,
        taskDescription ? `Görev: ${taskDescription}` : "",
      ].filter(Boolean).join("<br/>");
    } catch {
      if (summaryEl) summaryEl.textContent = "Plan yüklenemedi.";
    }
  }

  async function openWizard() {
    try {
      const settings = await api.invoke("get-settings");
      const { isSelfBuildEnabled } = await import("./feature-visibility.js");
      if (!isSelfBuildEnabled(settings)) {
        ui.showToast("Self-Build devre dışı — Ayarlar → Eklentiler", true);
        return;
      }
    } catch {
      // continue if settings unavailable
    }
    overlay?.classList.remove("hidden");
    overlay?.setAttribute("aria-hidden", "false");
    showStep(0);
  }

  function closeWizard() {
    overlay?.classList.add("hidden");
    overlay?.setAttribute("aria-hidden", "true");
  }

  async function finishWizard() {
    const pipelineId = doc.getElementById("sbs-pipeline-id")?.value || "self-improve-feature-v1";
    const taskDescription = doc.getElementById("sbs-task-description")?.value?.trim() || "";
    const costProfile = doc.getElementById("sbs-cost-profile")?.value || "balanced";
    const finishBtn = doc.getElementById("sbs-btn-finish");
    if (finishBtn) {
      finishBtn.disabled = true;
      finishBtn.textContent = "Başlatılıyor…";
    }
    try {
      const capReport = await api.invoke("get-cline-capability-report");
      const settings = await api.invoke("get-settings");
      if (capReport?.variant && capReport.variant !== "fork" && settings?.codeAgentNativeEnabled !== true) {
        const proceed = window.confirm(
          "Pipeline otomatik faz zinciri Cline fork gerektirir; Marketplace'te fazlar manuel ilerler. Devam edilsin mi?",
        );
        if (!proceed) {
          return;
        }
      }
      const result = await api.invoke("start-build-pipeline", {
        pipelineId,
        options: { taskDescription, costProfile },
      });
      if (!result?.ok) {
        ui.showToast(result?.error || "Pipeline başlatılamadı", true);
        return;
      }
      if (Array.isArray(result.forkLimitations) && result.forkLimitations.length > 0) {
        ui.showToast(result.forkLimitations[0]);
      }
      ui.showToast(`Pipeline başladı — faz 1/${result.pipeline?.totalPhases || "?"}`);
      closeWizard();
    } finally {
      if (finishBtn) {
        finishBtn.disabled = false;
        finishBtn.textContent = "Pipeline başlat";
      }
    }
  }

  doc.getElementById("sbs-btn-close")?.addEventListener("click", closeWizard);
  doc.getElementById("sbs-btn-back")?.addEventListener("click", () => showStep(currentStep - 1));
  doc.getElementById("sbs-btn-next")?.addEventListener("click", () => showStep(currentStep + 1));
  doc.getElementById("sbs-btn-finish")?.addEventListener("click", () => void finishWizard());

  return { openWizard, closeWizard };
}
