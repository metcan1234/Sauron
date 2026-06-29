import { t } from "../i18n/index.js";

const PAGE_OPTIONS = [
  { id: "home", label: "Ana sayfa" },
  { id: "about", label: "Hakkımızda" },
  { id: "services", label: "Hizmetler" },
  { id: "contact", label: "İletişim" },
  { id: "blog", label: "Blog" },
];

const TONE_OPTIONS = [
  { id: "corporate", label: "Kurumsal", themeId: "kurumsal" },
  { id: "modern", label: "Modern", themeId: "modern" },
  { id: "luxury", label: "Lüks", themeId: "luks" },
];

const PAGE_SEO_LABELS = {
  home: "Ana Sayfa",
  about: "Hakkımızda",
  services: "Hizmetler",
  contact: "İletişim",
  blog: "Blog",
};

function brandToneToThemeId(brandTone) {
  const match = TONE_OPTIONS.find((option) => option.id === brandTone);
  return match?.themeId || "kurumsal";
}

function buildPageDetails(pages, companyName, tagline) {
  return pages.map((slug) => ({
    slug,
    seoTitle: PAGE_SEO_LABELS[slug] || slug,
    seoDescription: `${companyName} — ${PAGE_SEO_LABELS[slug] || slug}. ${tagline}`.trim().slice(0, 160),
  }));
}

export function createWebStudioController({ api, ui, win, doc }) {
  let currentStep = 0;
  let brief = {
    companyName: "",
    contactEmail: "",
    industry: "genel",
    tagline: "",
    pages: ["home", "about", "services", "contact"],
    primaryColor: "#1e3a5f",
    accentColor: "#c9a227",
    brandTone: "corporate",
    themeId: "kurumsal",
    pageDetails: [],
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
    brief.industry = doc.getElementById("ws-industry")?.value?.trim() || "genel";
    brief.contactEmail = doc.getElementById("ws-contact-email")?.value?.trim() || "";
    brief.tagline = doc.getElementById("ws-tagline")?.value?.trim() || "";
    brief.primaryColor = doc.getElementById("ws-primary-color")?.value || "#1e3a5f";
    brief.accentColor = doc.getElementById("ws-accent-color")?.value || "#c9a227";
    brief.brandTone = doc.getElementById("ws-brand-tone")?.value || "corporate";
    brief.themeId = brandToneToThemeId(brief.brandTone);
    brief.pages = PAGE_OPTIONS
      .filter((page) => doc.getElementById(`ws-page-${page.id}`)?.checked)
      .map((page) => page.id);
    if (!brief.pages.length) {
      brief.pages = ["home", "about", "services", "contact"];
    }
    brief.pageDetails = buildPageDetails(
      brief.pages,
      brief.companyName || "Şirket",
      brief.tagline || "",
    );
  }

  function fillForm(data) {
    brief = { ...brief, ...data };
    if (doc.getElementById("ws-company-name")) doc.getElementById("ws-company-name").value = brief.companyName || "";
    if (doc.getElementById("ws-industry")) doc.getElementById("ws-industry").value = brief.industry || "genel";
    if (doc.getElementById("ws-contact-email")) doc.getElementById("ws-contact-email").value = brief.contactEmail || "";
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
    syncThemeSwatch();
  }

  function syncThemeSwatch() {
    const tone = doc.getElementById("ws-brand-tone")?.value || "corporate";
    const themeId = brandToneToThemeId(tone);
    doc.querySelectorAll(".ws-theme-swatch").forEach((el) => {
      el.classList.toggle("active", el.getAttribute("data-theme") === themeId);
    });
  }

  async function renderSummary() {
    readForm();
    if (summaryEl) {
      const seoLines = (brief.pageDetails || []).map(
        (page) => `• ${page.slug}: ${page.seoTitle} — ${page.seoDescription}`,
      ).join("<br/>");
      summaryEl.innerHTML = `
        <p><strong>${brief.companyName || "—"}</strong> · ${brief.industry || "—"}</p>
        <p>${brief.tagline || "—"}</p>
        <p>Sayfalar: ${brief.pages.join(", ")}</p>
        <p>Renkler: ${brief.primaryColor} / ${brief.accentColor} · Tema: ${brief.themeId || brandToneToThemeId(brief.brandTone)}</p>
        <p><strong>${t("webStudioSeoSummary") || "SEO özeti"}</strong><br/>${seoLines || "—"}</p>
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

  async function openWizard(options = {}) {
    if (!overlay) return;
    const preset = String(options.preset || "").trim().toLowerCase();
    const corporateDefaults = {
      pages: ["home", "about", "services", "contact"],
      brandTone: "corporate",
      stack: "nextjs-tailwind",
      template: "corporate-nextjs",
      features: ["contactForm", "seo", "responsive"],
      locale: "tr",
    };
    try {
      const settings = await api.invoke("get-settings");
      const { isWebStudioEnabled } = await import("./feature-visibility.js");
      if (!isWebStudioEnabled(settings)) {
        ui.showToast("Web Studio devre dışı — Ayarlar → Eklentiler", true);
        return;
      }
    } catch {
      // continue if settings unavailable
    }
    try {
      const doctor = await api.invoke("run-sauron-doctor");
      const webCheck = doctor?.checks?.find((entry) => entry.id === "web-studio-ready");
      if (webCheck && webCheck.status !== "pass") {
        ui.showToast(`${webCheck.message} — Ayarlar → Sistem tanısı`, true);
        const proceed = await ui.confirmDialog({
          title: "Web Studio hazır değil",
          message: `${webCheck.message}\n\n${webCheck.fixHint || ""}\n\nYine de devam edilsin mi?`,
          confirmLabel: "Devam",
          cancelLabel: "İptal",
          confirmDanger: false,
        });
        if (!proceed) {
          return;
        }
      }
    } catch {
      // doctor unavailable — allow wizard
    }
    try {
      const loaded = await api.invoke("load-web-brief");
      if (loaded?.brief && loaded.exists) {
        fillForm(loaded.brief);
      } else if (preset === "corporate") {
        fillForm(corporateDefaults);
      }
    } catch {
      if (preset === "corporate") {
        fillForm(corporateDefaults);
      }
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
      const settings = await api.invoke("get-settings");
      const usePipeline = settings?.corporateWebAutoPipeline !== false
        && settings?.selfBuildEnabled !== false;

      if (usePipeline) {
        const pipeline = await api.invoke("start-build-pipeline", { pipelineId: "corporate-web-v3" });
        if (!pipeline?.ok) {
          ui.showToast(pipeline?.error || "Üretim hattı başlatılamadı", true);
          return;
        }
        ui.showToast("Kurumsal üretim hattı başlatıldı — Cline faz 1", false);
      } else {
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
      }
      ui.showToast(t("webStudioDone") || "Proje oluşturuldu — Cline görevi başlatıldı");
      closeWizard();
      await refreshPreviewButton();
      ui.showToast("Önizleme için VS Code terminalinde npm run dev çalıştırın, ardından 👁 kullanın.", false);
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

  doc.getElementById("btn-web-preview")?.addEventListener("click", () => {
    void openPreview();
  });
  doc.getElementById("ws-brand-tone")?.addEventListener("change", syncThemeSwatch);

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
    openPreview,
  };
}
