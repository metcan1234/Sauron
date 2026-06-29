export function createChatHistoryController({ api, doc = document, dom, log, ui, state, win = window }) {
  let searchDebounceTimer = null;
  let currentQuery = "";
  let drawerOpen = false;
  let currentFolders = [];

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
    const memoryLabel = session.isMemoryChat ? " · Hafızalı" : "";
    return `${count} mesaj${memoryLabel}${pinLabel}${when ? ` · ${when}` : ""}`;
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

  function renderSessionItem(session) {
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
    if (session.isMemoryChat) {
      item.classList.add("is-memory-chat");
    }
    item.dataset.sessionId = session.id;

    const body = doc.createElement("div");
    body.className = "chat-drawer-item-body";

    const title = doc.createElement("div");
    title.className = "chat-drawer-item-title";
    title.textContent = session.ephemeral
      ? `${session.title || "Geçici sohbet"} · geçici`
      : session.isMemoryChat
        ? `${session.title || "Kalıcı sohbet"} · hafızalı`
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

    const moveBtn = doc.createElement("button");
    moveBtn.type = "button";
    moveBtn.className = "chat-drawer-item-move";
    moveBtn.title = "Klasöre taşı";
    moveBtn.textContent = "📁";
    if (session.ephemeral) {
      moveBtn.disabled = true;
      moveBtn.title = "Geçici sohbetler taşınamaz";
    }
    moveBtn.addEventListener("click", async (event) => {
      event.stopPropagation();
      await promptMoveToFolder(session);
    });

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

    actions.appendChild(moveBtn);
    actions.appendChild(pinBtn);
    actions.appendChild(renameBtn);
    actions.appendChild(duplicateBtn);
    actions.appendChild(exportBtn);
    actions.appendChild(deleteBtn);
    item.appendChild(body);
    item.appendChild(actions);
    return item;
  }

  async function promptMoveToFolder(session) {
    const choice = await ui.promptDialog({
      title: "Klasöre taşı",
      message: "Hedef klasör adını yazın (boş = klasörsüz):",
      defaultValue: currentFolders.find((folder) => folder.id === session.folderId)?.name || "",
      confirmLabel: "Taşı",
      cancelLabel: "İptal",
    });
    if (choice === null) {
      return;
    }
    const trimmed = String(choice).trim();
    let folderId = null;
    if (trimmed) {
      const existing = currentFolders.find((folder) => folder.name.toLowerCase() === trimmed.toLowerCase());
      if (existing) {
        folderId = existing.id;
      } else {
        const created = await api.invoke("create-chat-folder", { name: trimmed });
        if (!created?.ok) {
          ui.showToast(created?.error || "Klasör oluşturulamadı", true);
          return;
        }
        currentFolders = created.folders || currentFolders;
        folderId = created.folder?.id || null;
      }
    }
    try {
      const result = await api.invoke("move-chat-session", { sessionId: session.id, folderId });
      if (!result?.ok) {
        ui.showToast(result?.error || "Taşıma başarısız", true);
        return;
      }
      currentFolders = result.folders || currentFolders;
      renderSessionList(result.sessions || []);
      ui.showToast("Sohbet taşındı");
    } catch (error) {
      log("move-chat-session error", error);
      ui.showToast("Taşıma başarısız", true);
    }
  }

  function renderFolderSection(folder, sessions) {
    const section = doc.createElement("div");
    section.className = "chat-drawer-folder";

    const header = doc.createElement("div");
    header.className = "chat-drawer-folder-header";
    header.textContent = folder?.name || "Klasör";
    section.appendChild(header);

    const list = doc.createElement("div");
    list.className = "chat-drawer-folder-list";
    const folderSessions = sessions.filter((session) => session.folderId === folder.id);
    if (folderSessions.length === 0) {
      const empty = doc.createElement("div");
      empty.className = "chat-drawer-folder-empty";
      empty.textContent = "Bu klasörde sohbet yok.";
      list.appendChild(empty);
    } else {
      for (const session of folderSessions) {
        list.appendChild(renderSessionItem(session));
      }
    }
    section.appendChild(list);
    return section;
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

    for (const folder of currentFolders) {
      dom.chatDrawerList.appendChild(renderFolderSection(folder, sessions));
    }

    const unfoldered = sessions.filter((session) => !session.folderId);
    if (currentFolders.length > 0) {
      const section = doc.createElement("div");
      section.className = "chat-drawer-folder";
      const header = doc.createElement("div");
      header.className = "chat-drawer-folder-header";
      header.textContent = "Klasörsüz";
      section.appendChild(header);
      const list = doc.createElement("div");
      list.className = "chat-drawer-folder-list";
      for (const session of unfoldered) {
        list.appendChild(renderSessionItem(session));
      }
      section.appendChild(list);
      dom.chatDrawerList.appendChild(section);
    } else {
      for (const session of sessions) {
        dom.chatDrawerList.appendChild(renderSessionItem(session));
      }
    }
  }

  async function createFolder() {
    const name = await ui.promptDialog({
      title: "Yeni klasör",
      message: "Klasör adını girin:",
      defaultValue: "",
      confirmLabel: "Oluştur",
      cancelLabel: "İptal",
    });
    if (name === null) {
      return;
    }
    const trimmed = String(name).trim();
    if (!trimmed) {
      ui.showToast("Klasör adı boş olamaz", true);
      return;
    }
    try {
      const result = await api.invoke("create-chat-folder", { name: trimmed });
      if (!result?.ok) {
        ui.showToast(result?.error || "Klasör oluşturulamadı", true);
        return;
      }
      currentFolders = result.folders || [];
      await refreshSessionList(currentQuery);
      ui.showToast("Klasör oluşturuldu");
    } catch (error) {
      log("create-chat-folder error", error);
      ui.showToast("Klasör oluşturulamadı", true);
    }
  }

  async function refreshSessionList(query = currentQuery) {
    try {
      const result = await api.invoke("list-chat-sessions", { query });
      currentFolders = result?.folders || [];
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

  async function createMemoryChat() {
    const title = await ui.promptDialog({
      title: "Kalıcı hafızalı sohbet",
      message: "Bu konu için bir isim verin (örn. Diyet ve Spor):",
      defaultValue: "",
      confirmLabel: "Oluştur",
      cancelLabel: "İptal",
    });
    if (title === null) {
      return;
    }
    const trimmed = String(title).trim() || "Kalıcı sohbet";
    try {
      const result = await api.invoke("create-memory-chat-session", { title: trimmed });
      if (!result?.ok && result?.session === undefined) {
        ui.showToast(result?.error || "Kalıcı sohbet açılamadı", true);
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
      ui.showToast("Kalıcı hafızalı sohbet oluşturuldu");
    } catch (error) {
      log("create-memory-chat-session error", error);
      ui.showToast("Kalıcı sohbet açılamadı", true);
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
    dom.chatDrawerMemory?.addEventListener("click", () => {
      void createMemoryChat();
    });
    dom.chatDrawerCreateFolder?.addEventListener("click", () => {
      void createFolder();
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
