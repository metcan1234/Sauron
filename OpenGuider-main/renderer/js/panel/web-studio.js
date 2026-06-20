import { t } from "../i18n/index.js";

const PAGE_OPTIONS = [
  { id: "home", label: "Ana sayfa" },
  { id: "about", label: "Hakkımızda" },
  { id: "services", label: "Hizmetler" },
  { id: "contact", label: "İletişim" },
  { id: "blog", label: "Blog" },
];

const TONE_OPTIONS = [
  { id: "corporate", label: "Kurumsal" },
  { id: "modern", label: "Modern" },
  { id: "luxury", label: "Lüks" },
];

export function createWebStudioController({ api, ui, win, doc }) {
  let currentStep = 0;
  let brief = {
    companyName: "",
    industry: "",
    tagline: "",
    pages: ["home", "about", "services", "contact"],
    primaryColor: "#1e3a5f",
    accentColor: "#c9a227",
    brandTone: "corporate",
    locale: "tr",
    features: ["contactForm"],
    stack: "nextjs-tailwind",
    template: "corporate-nextjs",
  };

  const overlay = doc.getElementById("web-studio-overlay");
  const steps = Array.from(doc.querySelectorAll(".web-studio-step"));
  const summaryEl = doc.getElementById("web-studio-summary");
  const checklistPreview = doc.getElementById("web-studio-checklist-preview");

  function readForm() {
    brief.companyName = doc.getElementById("ws-company-name")?.value?.trim() || "";
    brief.industry = doc.getElementById("ws-industry")?.value?.trim() || "";
    brief.tagline = doc.getElementById("ws-tagline")?.value?.trim() || "";
    brief.primaryColor = doc.getElementById("ws-primary-color")?.value || "#1e3a5f";
    brief.accentColor = doc.getElementById("ws-accent-color")?.value || "#c9a227";
    brief.brandTone = doc.getElementById("ws-brand-tone")?.value || "corporate";
    brief.pages = PAGE_OPTIONS
      .filter((page) => doc.getElementById(`ws-page-${page.id}`)?.checked)
      .map((page) => page.id);
    if (!brief.pages.length) {
      brief.pages = ["home", "about", "services", "contact"];
    }
  }

  function fillForm(data) {
    brief = { ...brief, ...data };
    if (doc.getElementById("ws-company-name")) doc.getElementById("ws-company-name").value = brief.companyName || "";
    if (doc.getElementById("ws-industry")) doc.getElementById("ws-industry").value = brief.industry || "";
    if (doc.getElementById("ws-tagline")) doc.getElementById("ws-tagline").value = brief.tagline || "";
    if (doc.getElementById("ws-primary-color")) doc.getElementById("ws-primary-color").value = brief.primaryColor || "#1e3a5f";
    if (doc.getElementById("ws-accent-color")) doc.getElementById("ws-accent-color").value = brief.accentColor || "#c9a227";
    if (doc.getElementById("ws-brand-tone")) doc.getElementById("ws-brand-tone").value = brief.brandTone || "corporate";
    for (const page of PAGE_OPTIONS) {
      const checkbox = doc.getElementById(`ws-page-${page.id}`);
      if (checkbox) {
        checkbox.checked = brief.pages.includes(page.id);
      }
    }
  }

  function showStep(stepIndex) {
    currentStep = Math.max(0, Math.min(stepIndex, steps.length - 1));
    steps.forEach((step, index) => {
      step.classList.toggle("hidden", index !== currentStep);
    });
    const backBtn = doc.getElementById("ws-btn-back");
    const nextBtn = doc.getElementById("ws-btn-next");
    const finishBtn = doc.getElementById("ws-btn-finish");
    if (backBtn) backBtn.disabled = currentStep === 0;
    if (nextBtn) nextBtn.classList.toggle("hidden", currentStep >= steps.length - 1);
    if (finishBtn) finishBtn.classList.toggle("hidden", currentStep < steps.length - 1);
    if (currentStep === steps.length - 1) {
      renderSummary();
    }
  }

  async function renderSummary() {
    readForm();
    if (summaryEl) {
      summaryEl.innerHTML = `
        <p><strong>${brief.companyName || "—"}</strong> · ${brief.industry || "—"}</p>
        <p>${brief.tagline || "—"}</p>
        <p>Sayfalar: ${brief.pages.join(", ")}</p>
        <p>Renkler: ${brief.primaryColor} / ${brief.accentColor} · ${brief.brandTone}</p>
      `;
    }
    try {
      const checklist = await api.invoke("get-web-quality-checklist", { brief });
      if (checklistPreview && checklist?.markdown) {
        checklistPreview.textContent = checklist.markdown.slice(0, 600) + (checklist.markdown.length > 600 ? "…" : "");
      }
    } catch {
      if (checklistPreview) checklistPreview.textContent = "";
    }
  }

  async function openWizard() {
    if (!overlay) return;
    try {
      const loaded = await api.invoke("load-web-brief");
      if (loaded?.brief) {
        fillForm(loaded.brief);
      }
    } catch {
      // use defaults
    }
    overlay.classList.remove("hidden");
    overlay.setAttribute("aria-hidden", "false");
    showStep(0);
  }

  function closeWizard() {
    if (!overlay) return;
    overlay.classList.add("hidden");
    overlay.setAttribute("aria-hidden", "true");
  }

  async function finishWizard() {
    readForm();
    const finishBtn = doc.getElementById("ws-btn-finish");
    if (finishBtn) {
      finishBtn.disabled = true;
      finishBtn.textContent = t("webStudioWorking") || "Oluşturuluyor…";
    }
    try {
      await api.invoke("save-web-brief", { brief });
      const scaffold = await api.invoke("scaffold-web-project", { brief });
      if (!scaffold?.ok) {
        ui.showToast(scaffold?.error || scaffold?.errors?.join(", ") || "Scaffold başarısız", true);
        return;
      }
      const handoff = await api.invoke("open-workspace-handoff", { force: false });
      if (handoff?.needsConfirm) {
        const confirmed = await ui.confirmDialog({
          title: t("webStudioHandoffConfirmTitle") || "Devam edilsin mi?",
          message: handoff.message,
          confirmLabel: t("confirmClear") || "Devam",
          cancelLabel: t("cancel") || "İptal",
        });
        if (confirmed) {
          await api.invoke("open-workspace-handoff", { force: true });
        }
      } else if (!handoff?.ok) {
        ui.showToast(handoff?.error || "Handoff başarısız", true);
        return;
      }
      ui.showToast(t("webStudioDone") || "Proje oluşturuldu — Cline görevi başlatıldı");
      closeWizard();
      await refreshPreviewButton();
    } finally {
      if (finishBtn) {
        finishBtn.disabled = false;
        finishBtn.textContent = t("webStudioFinish") || "Oluştur ve Cline'a gönder";
      }
    }
  }

  async function refreshPreviewButton() {
    const previewBtn = doc.getElementById("btn-web-preview");
    if (!previewBtn) return;
    try {
      const status = await api.invoke("get-web-project-status");
      previewBtn.classList.toggle("hidden", !status?.isNext);
    } catch {
      previewBtn.classList.add("hidden");
    }
  }

  async function openPreview() {
    const result = await api.invoke("open-web-preview", { port: 3000 });
    if (!result?.ok) {
      ui.showToast(
        result?.error || "Bu workspace'te web sitesi yok. Ekran yardımı için mesaj gönderin (📷 Otomatik açık).",
        true,
      );
      return;
    }
    if (result.hint) {
      ui.showToast(result.hint);
    }
  }

  doc.getElementById("btn-web-studio")?.addEventListener("click", () => {
    void openWizard();
  });
  doc.getElementById("btn-web-preview")?.addEventListener("click", () => {
    void openPreview();
  });
  doc.getElementById("ws-btn-close")?.addEventListener("click", closeWizard);
  doc.getElementById("ws-btn-back")?.addEventListener("click", () => showStep(currentStep - 1));
  doc.getElementById("ws-btn-next")?.addEventListener("click", () => {
    readForm();
    showStep(currentStep + 1);
  });
  doc.getElementById("ws-btn-finish")?.addEventListener("click", () => {
    void finishWizard();
  });

  void refreshPreviewButton();
  win.setInterval(() => {
    void refreshPreviewButton();
  }, 30000);

  return {
    openWizard,
    closeWizard,
    refreshPreviewButton,
  };
}
