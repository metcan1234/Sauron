export function createChatHistoryController({ api, doc = document, dom, log, ui, state, win = window }) {
  let searchDebounceTimer = null;
  let currentQuery = "";
  let drawerOpen = false;

  function formatRelativeTime(isoDate) {
    if (!isoDate) {
      return "";
    }
    const then = Date.parse(isoDate);
    if (Number.isNaN(then)) {
      return "";
    }
    const diffMs = Date.now() - then;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) {
      return "Az önce";
    }
    if (diffMin < 60) {
      return `${diffMin} dk önce`;
    }
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) {
      return `${diffHours} sa önce`;
    }
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) {
      return "Dün";
    }
    if (diffDays < 7) {
      return `${diffDays} gün önce`;
    }
    return new Date(isoDate).toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "short",
    });
  }

  function formatSessionMeta(session) {
    const count = Number(session?.messageCount) || 0;
    const when = formatRelativeTime(session?.updatedAt);
    const pinLabel = session.pinned ? " · Sabitlendi" : "";
    return `${count} mesaj${pinLabel}${when ? ` · ${when}` : ""}`;
  }

  async function promptRename(session) {
    const currentTitle = session.title || "Yeni sohbet";
    const nextTitle = await ui.promptDialog({
      title: "Sohbet adını düzenle",
      message: "Yeni sohbet adını girin:",
      defaultValue: currentTitle,
      confirmLabel: "Kaydet",
      cancelLabel: "İptal",
    });
    if (nextTitle === null) {
      return;
    }
    const trimmed = String(nextTitle).trim();
    if (!trimmed) {
      ui.showToast("Sohbet adı boş olamaz", true);
      return;
    }
    if (trimmed === currentTitle) {
      return;
    }
    try {
      const result = await api.invoke("rename-chat-session", {
        sessionId: session.id,
        title: trimmed,
      });
      if (!result?.ok) {
        ui.showToast(result?.error || "Sohbet adı güncellenemedi", true);
        return;
      }
      renderSessionList(result.sessions || []);
      ui.showToast("Sohbet adı güncellendi");
    } catch (error) {
      log("rename-chat-session error", error);
      ui.showToast("Sohbet adı güncellenemedi", true);
    }
  }

  async function exportSession(sessionId, { silentCancel = false } = {}) {
    try {
      const result = await api.invoke("export-chat-session", { sessionId });
      if (result?.canceled) {
        if (!silentCancel) {
          return;
        }
        return;
      }
      if (!result?.ok) {
        ui.showToast(result?.error || "Dışa aktarma başarısız", true);
        return;
      }
      ui.showToast(`Sohbet kaydedildi: ${result.path}`);
    } catch (error) {
      log("export-chat-session error", error);
      ui.showToast("Dışa aktarma başarısız", true);
    }
  }

  async function duplicateSession(session) {
    try {
      const result = await api.invoke("duplicate-chat-session", { sessionId: session.id });
      if (!result?.ok) {
        ui.showToast(result?.error || "Sohbet kopyalanamadı", true);
        return;
      }
      const snapshot = result.snapshot || result.session?.snapshot || { messages: [] };
      state.setSessionSnapshot(snapshot);
      ui.renderConversation(snapshot.messages || []);
      ui.renderAgentState(snapshot.status || "idle");
      renderSessionList(result.sessions || []);
      ui.showToast("Sohbet kopyalandı");
    } catch (error) {
      log("duplicate-chat-session error", error);
      ui.showToast("Sohbet kopyalanamadı", true);
    }
  }

  function renderSessionList(sessions = []) {
    if (!dom.chatDrawerList) {
      return;
    }

    dom.chatDrawerList.innerHTML = "";
    if (!Array.isArray(sessions) || sessions.length === 0) {
      const empty = doc.createElement("div");
      empty.className = "chat-drawer-empty";
      empty.textContent = currentQuery
        ? "Aramanızla eşleşen sohbet bulunamadı."
        : "Henüz kayıtlı sohbet yok.";
      dom.chatDrawerList.appendChild(empty);
      return;
    }

    for (const session of sessions) {
      const item = doc.createElement("div");
      item.className = "chat-drawer-item";
      if (session.isActive) {
        item.classList.add("is-active");
      }
      if (session.pinned) {
        item.classList.add("is-pinned");
      }
      if (session.ephemeral) {
        item.classList.add("is-ephemeral");
      }
      item.dataset.sessionId = session.id;

      const body = doc.createElement("div");
      body.className = "chat-drawer-item-body";

      const title = doc.createElement("div");
      title.className = "chat-drawer-item-title";
      title.textContent = session.ephemeral
        ? `${session.title || "Geçici sohbet"} · geçici`
        : (session.title || "Yeni sohbet");

      const meta = doc.createElement("div");
      meta.className = "chat-drawer-item-meta";
      meta.textContent = formatSessionMeta(session);

      body.appendChild(title);
      body.appendChild(meta);

      if (session.preview) {
        const preview = doc.createElement("div");
        preview.className = "chat-drawer-item-preview";
        preview.textContent = session.preview;
        body.appendChild(preview);
      }

      const actions = doc.createElement("div");
      actions.className = "chat-drawer-item-actions";

      const pinBtn = doc.createElement("button");
      pinBtn.type = "button";
      pinBtn.className = `chat-drawer-item-pin${session.pinned ? " is-pinned" : ""}`;
      pinBtn.title = session.pinned ? "Sabitlemeyi kaldır" : "Sabitle";
      pinBtn.textContent = "📌";
      if (session.ephemeral) {
        pinBtn.disabled = true;
        pinBtn.title = "Geçici sohbetler sabitlenemez";
      }
      pinBtn.addEventListener("click", async (event) => {
        event.stopPropagation();
        try {
          const result = await api.invoke("toggle-pin-chat-session", { sessionId: session.id });
          if (!result?.ok) {
            ui.showToast(result?.error || "Sabitleme güncellenemedi", true);
            return;
          }
          renderSessionList(result.sessions || []);
        } catch (error) {
          log("toggle-pin-chat-session error", error);
          ui.showToast("Sabitleme güncellenemedi", true);
        }
      });

      const renameBtn = doc.createElement("button");
      renameBtn.type = "button";
      renameBtn.className = "chat-drawer-item-rename";
      renameBtn.title = "Yeniden adlandır";
      renameBtn.textContent = "✏️";
      if (session.ephemeral) {
        renameBtn.disabled = true;
        renameBtn.title = "Geçici sohbetler yeniden adlandırılamaz";
      }
      renameBtn.addEventListener("click", async (event) => {
        event.stopPropagation();
        await promptRename(session);
      });

      const duplicateBtn = doc.createElement("button");
      duplicateBtn.type = "button";
      duplicateBtn.className = "chat-drawer-item-duplicate";
      duplicateBtn.title = "Kopyala";
      duplicateBtn.textContent = "⧉";
      duplicateBtn.addEventListener("click", async (event) => {
        event.stopPropagation();
        await duplicateSession(session);
      });

      const exportBtn = doc.createElement("button");
      exportBtn.type = "button";
      exportBtn.className = "chat-drawer-item-export";
      exportBtn.title = "Markdown olarak dışa aktar";
      exportBtn.textContent = "⬇";
      if (session.ephemeral) {
        exportBtn.disabled = true;
        exportBtn.title = "Geçici sohbetler dışa aktarılamaz";
      }
      exportBtn.addEventListener("click", async (event) => {
        event.stopPropagation();
        await exportSession(session.id);
      });

      const deleteBtn = doc.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "chat-drawer-item-delete";
      deleteBtn.title = "Sohbeti sil";
      deleteBtn.textContent = "🗑";
      deleteBtn.addEventListener("click", async (event) => {
        event.stopPropagation();
        const shouldDelete = await ui.confirmDialog({
          title: "Sohbet silinsin mi?",
          message: `"${session.title || "Yeni sohbet"}" kalıcı olarak silinecek.`,
          confirmLabel: "Sil",
          cancelLabel: "İptal",
          confirmDanger: true,
        });
        if (!shouldDelete) {
          return;
        }
        try {
          const result = await api.invoke("delete-chat-session", { sessionId: session.id });
          if (!result?.ok) {
            ui.showToast(result?.error || "Sohbet silinemedi", true);
            return;
          }
          if (result.snapshot) {
            state.setSessionSnapshot(result.snapshot);
            ui.renderConversation(result.snapshot.messages || []);
            ui.renderAgentState(result.snapshot.status || "idle");
          }
          renderSessionList(result.sessions || []);
        } catch (error) {
          log("delete-chat-session error", error);
          ui.showToast("Sohbet silinemedi", true);
        }
      });

      item.addEventListener("click", async () => {
        if (session.isActive) {
          closeDrawer();
          return;
        }
        try {
          const result = await api.invoke("load-chat-session", { sessionId: session.id });
          if (!result?.ok) {
            ui.showToast(result?.error || "Sohbet yüklenemedi", true);
            return;
          }
          const snapshot = result.snapshot || {};
          state.setSessionSnapshot(snapshot);
          ui.renderConversation(snapshot.messages || []);
          ui.renderAgentState(snapshot.status || "idle");
          ui.hideErrorBanner();
          ui.hideWorkspaceStatus();
          renderSessionList(result.sessions || []);
          closeDrawer();
        } catch (error) {
          log("load-chat-session error", error);
          ui.showToast("Sohbet yüklenemedi", true);
        }
      });

      actions.appendChild(pinBtn);
      actions.appendChild(renameBtn);
      actions.appendChild(duplicateBtn);
      actions.appendChild(exportBtn);
      actions.appendChild(deleteBtn);
      item.appendChild(body);
      item.appendChild(actions);
      dom.chatDrawerList.appendChild(item);
    }
  }

  async function refreshSessionList(query = currentQuery) {
    try {
      const result = await api.invoke("list-chat-sessions", { query });
      renderSessionList(result?.sessions || []);
    } catch (error) {
      log("list-chat-sessions error", error);
    }
  }

  function scheduleSearch(query) {
    currentQuery = String(query || "").trim();
    if (searchDebounceTimer) {
      win.clearTimeout(searchDebounceTimer);
    }
    searchDebounceTimer = win.setTimeout(() => {
      void refreshSessionList(currentQuery);
    }, 180);
  }

  function openDrawer() {
    if (!dom.chatDrawerOverlay) {
      return;
    }
    drawerOpen = true;
    dom.chatDrawerOverlay.classList.remove("hidden");
    dom.chatDrawerOverlay.setAttribute("aria-hidden", "false");
    if (dom.chatDrawerSearch) {
      dom.chatDrawerSearch.value = currentQuery;
    }
    void refreshSessionList(currentQuery);
    win.setTimeout(() => dom.chatDrawerSearch?.focus(), 0);
  }

  function closeDrawer() {
    if (!dom.chatDrawerOverlay) {
      return;
    }
    drawerOpen = false;
    dom.chatDrawerOverlay.classList.add("hidden");
    dom.chatDrawerOverlay.setAttribute("aria-hidden", "true");
  }

  function isDrawerOpen() {
    return drawerOpen;
  }

  async function createNewChat() {
    try {
      const result = await api.invoke("create-chat-session");
      if (!result?.ok && result?.session === undefined) {
        ui.showToast(result?.error || "Yeni sohbet açılamadı", true);
        return;
      }
      const snapshot = result.snapshot || result.session?.snapshot || { messages: [] };
      state.setSessionSnapshot(snapshot);
      ui.renderConversation(snapshot.messages || []);
      ui.renderAgentState("idle");
      ui.hideErrorBanner();
      renderSessionList(result.sessions || []);
      closeDrawer();
      dom.textInput?.focus();
    } catch (error) {
      log("create-chat-session error", error);
      ui.showToast("Yeni sohbet açılamadı", true);
    }
  }

  async function createEphemeralChat() {
    try {
      const result = await api.invoke("create-ephemeral-chat-session");
      if (!result?.ok && result?.session === undefined) {
        ui.showToast(result?.error || "Geçici sohbet açılamadı", true);
        return;
      }
      const snapshot = result.snapshot || result.session?.snapshot || { messages: [] };
      state.setSessionSnapshot(snapshot);
      ui.renderConversation(snapshot.messages || []);
      ui.renderAgentState("idle");
      ui.hideErrorBanner();
      renderSessionList(result.sessions || []);
      closeDrawer();
      dom.textInput?.focus();
      ui.showToast("Geçici sohbet — yeniden başlatınca kaybolur");
    } catch (error) {
      log("create-ephemeral-chat-session error", error);
      ui.showToast("Geçici sohbet açılamadı", true);
    }
  }

  async function exportActiveSession() {
    try {
      const result = await api.invoke("list-chat-sessions");
      const active = (result?.sessions || []).find((entry) => entry.isActive);
      if (!active?.id) {
        ui.showToast("Aktif sohbet bulunamadı", true);
        return;
      }
      if (active.ephemeral) {
        ui.showToast("Geçici sohbetler dışa aktarılamaz", true);
        return;
      }
      await exportSession(active.id);
    } catch (error) {
      log("export-active-session error", error);
      ui.showToast("Dışa aktarma başarısız", true);
    }
  }

  function bindEvents() {
    dom.btnChatHistory?.addEventListener("click", openDrawer);
    dom.chatDrawerClose?.addEventListener("click", closeDrawer);
    dom.chatDrawerNew?.addEventListener("click", () => {
      void createNewChat();
    });
    dom.chatDrawerEphemeral?.addEventListener("click", () => {
      void createEphemeralChat();
    });
    dom.chatDrawerExportActive?.addEventListener("click", () => {
      void exportActiveSession();
    });
    dom.chatDrawerSearch?.addEventListener("input", (event) => {
      scheduleSearch(event.target.value);
    });
    dom.chatDrawerOverlay?.addEventListener("click", (event) => {
      if (event.target === dom.chatDrawerOverlay) {
        closeDrawer();
      }
    });
    doc.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && drawerOpen) {
        closeDrawer();
      }
    });
  }

  return {
    bindEvents,
    closeDrawer,
    createEphemeralChat,
    createNewChat,
    isDrawerOpen,
    openDrawer,
    refreshSessionList,
    renderSessionList,
  };
}
