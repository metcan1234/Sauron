export function createGamedevQuickSetupController({ api, doc, state, ui, log }) {
  const overlay = doc.getElementById("gamedev-setup-overlay");
  let step = 0;
  let resolveWait = null;

  function shouldOffer(settings = {}) {
    if (settings.gamedevQuickSetupDismissed === true) {
      return false;
    }
    if (settings.gamedevSetupComplete === true) {
      return false;
    }
    return settings.gamedevEnabled !== false;
  }

  function hide() {
    overlay?.classList.add("hidden");
    if (resolveWait) {
      resolveWait(false);
      resolveWait = null;
    }
  }

  function showStep(nextStep) {
    step = Math.max(0, Math.min(2, nextStep));
    const progressEl = doc.getElementById("gamedev-setup-progress");
    if (progressEl) {
      progressEl.textContent = `Adım ${step + 1} / 3`;
    }
    for (let index = 1; index <= 3; index += 1) {
      doc.getElementById(`gamedev-setup-step-${index}`)?.classList.toggle("hidden", index !== step + 1);
    }
    doc.getElementById("gamedev-setup-prev")?.classList.toggle("hidden", step === 0);
    doc.getElementById("gamedev-setup-next")?.classList.toggle("hidden", step === 2);
    doc.getElementById("gamedev-setup-done")?.classList.toggle("hidden", step !== 2);
  }

  async function refreshStatuses() {
    const wsStatus = doc.getElementById("gamedev-setup-workspace-status");
    const bridgeStatus = doc.getElementById("gamedev-setup-bridge-status");
    const doctorStatus = doc.getElementById("gamedev-setup-doctor-status");
    try {
      const settings = state.getSettings?.() || await api.invoke("get-settings");
      const wsPath = String(settings?.workspacePath || "").trim();
      if (wsStatus) {
        wsStatus.textContent = wsPath
          ? `Çalışma klasörü: ${wsPath}`
          : "Henüz workspace seçilmedi — Ayarlar → Çalışma Kısmı.";
      }
      if (bridgeStatus) {
        try {
          const bridge = await api.invoke("get-gamedev-bridge-status");
          bridgeStatus.textContent = bridge?.summary
            || "Unity MCP bridge ve Cline gamedev MCP kurulumunu tamamlayın.";
        } catch {
          bridgeStatus.textContent = "Unity MCP bridge ve Cline gamedev MCP kurulumunu tamamlayın.";
        }
      }
      if (doctorStatus) {
        const doctor = await api.invoke("run-sauron-doctor");
        const checks = Array.isArray(doctor?.checks) ? doctor.checks : [];
        const failed = checks.filter((check) => check.status !== "pass");
        doctorStatus.textContent = failed.length
          ? `${failed.length} kontrol eksik — kurulum adımlarını tamamlayın.`
          : "Doctor kontrolleri geçti.";
      }
    } catch (error) {
      log?.("gamedev-setup status error", error);
    }
  }

  function finishSetup(confirmed) {
    overlay?.classList.add("hidden");
    if (confirmed) {
      void api.invoke("save-settings", {
        gamedevSetupComplete: true,
        gamedevQuickSetupDismissed: true,
        gamedevDefaultTemplate: doc.getElementById("gamedev-setup-template")?.value || "custom",
      });
    }
    if (resolveWait) {
      resolveWait(Boolean(confirmed));
      resolveWait = null;
    }
  }

  function bindEvents() {
    doc.getElementById("gamedev-setup-prev")?.addEventListener("click", () => {
      showStep(step - 1);
    });
    doc.getElementById("gamedev-setup-next")?.addEventListener("click", async () => {
      if (step < 2) {
        showStep(step + 1);
        await refreshStatuses();
        return;
      }
      finishSetup(true);
    });
    doc.getElementById("gamedev-setup-done")?.addEventListener("click", () => {
      finishSetup(true);
    });
    doc.getElementById("gamedev-setup-fix")?.addEventListener("click", async () => {
      const fixBtn = doc.getElementById("gamedev-setup-fix");
      const bridgeStatus = doc.getElementById("gamedev-setup-bridge-status");
      if (fixBtn) {
        fixBtn.disabled = true;
        fixBtn.textContent = "Kurulum çalışıyor…";
      }
      try {
        const result = await api.invoke("fix-gamedev-setup", {});
        if (bridgeStatus) {
          bridgeStatus.textContent = result?.ok
            ? (result.summary || "MCP build ve config tamamlandı.")
            : (result?.error || "Kurulum başarısız.");
        }
        if (result?.ok) {
          ui?.showToast?.("Game Dev kurulum adımı tamamlandı", false);
        }
      } catch (error) {
        log?.("gamedev-setup fix error", error);
        if (bridgeStatus) {
          bridgeStatus.textContent = error.message || "Kurulum hatası.";
        }
      } finally {
        if (fixBtn) {
          fixBtn.disabled = false;
          fixBtn.textContent = "Tek tık fix (MCP build + config)";
        }
        await refreshStatuses();
      }
    });
    overlay?.addEventListener("click", (event) => {
      if (event.target === overlay) {
        finishSetup(false);
      }
    });
  }

  async function maybeShow() {
    const settings = state.getSettings?.() || await api.invoke("get-settings");
    if (!shouldOffer(settings)) {
      return true;
    }
    if (!overlay) {
      return true;
    }
    showStep(0);
    await refreshStatuses();
    overlay.classList.remove("hidden");
    return new Promise((resolve) => {
      resolveWait = resolve;
    });
  }

  return { bindEvents, maybeShow, shouldOffer };
}
