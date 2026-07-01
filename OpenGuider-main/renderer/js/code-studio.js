const api = window.sauron;

let activeFilePath = "";
let allFiles = [];
let dirty = false;
let monacoEditor = null;
let monacoEnabled = false;
let useMonaco = false;
let studioV3Enabled = true;
let latestCheckpointId = null;
const openTabs = new Map();

function appendLog(line) {
  const el = document.getElementById("agent-log");
  if (!el) return;
  const ts = new Date().toLocaleTimeString("tr-TR");
  el.textContent = `${ts} — ${line}\n` + el.textContent;
}

function basename(filePath) {
  return String(filePath || "").split(/[/\\]/).pop() || filePath;
}

function getTextareaEl() {
  return document.getElementById("file-content");
}

function getMonacoContainer() {
  return document.getElementById("monaco-container");
}

function getEditorContent() {
  if (useMonaco && monacoEditor) {
    return monacoEditor.getValue();
  }
  return getTextareaEl()?.value ?? "";
}

function setEditorContent(content) {
  if (useMonaco && monacoEditor) {
    monacoEditor.setValue(content);
    return;
  }
  const textarea = getTextareaEl();
  if (textarea) {
    textarea.value = content;
  }
}

function setDirty(next) {
  dirty = Boolean(next);
  const saveBtn = document.getElementById("btn-save-file");
  if (saveBtn) {
    saveBtn.disabled = !dirty;
  }
  if (studioV3Enabled && activeFilePath && openTabs.has(activeFilePath)) {
    openTabs.get(activeFilePath).dirty = dirty;
    renderTabs();
  }
}

function syncActiveTabContent() {
  if (!studioV3Enabled || !activeFilePath) {
    return;
  }
  if (!openTabs.has(activeFilePath)) {
    openTabs.set(activeFilePath, { content: getEditorContent(), dirty });
    return;
  }
  const tab = openTabs.get(activeFilePath);
  tab.content = getEditorContent();
  tab.dirty = dirty;
}

function renderTabs() {
  const container = document.getElementById("editor-tabs");
  if (!container) {
    return;
  }
  if (!studioV3Enabled) {
    container.replaceChildren();
    return;
  }
  container.replaceChildren();
  for (const path of openTabs.keys()) {
    const tabState = openTabs.get(path);
    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = "code-studio-tab";
    if (path === activeFilePath) {
      tab.classList.add("active");
    }
    if (tabState?.dirty) {
      tab.classList.add("is-dirty");
    }
    tab.textContent = basename(path);
    tab.title = path;
    tab.addEventListener("click", () => {
      void switchToTab(path);
    });
    container.appendChild(tab);
  }
}

async function switchToTab(filePath) {
  if (filePath === activeFilePath) {
    return;
  }
  syncActiveTabContent();
  activeFilePath = filePath;
  const tabState = openTabs.get(filePath);
  if (!tabState) {
    return;
  }
  setEditorContent(tabState.content || "");
  setDirty(Boolean(tabState.dirty));
  if (useMonaco && monacoEditor) {
    const model = monacoEditor.getModel();
    if (model) {
      window.monaco.editor.setModelLanguage(model, guessLanguage(filePath));
    }
  }
  document.querySelectorAll(".file-item").forEach((el) => {
    el.classList.toggle("active", el.dataset.path === filePath);
  });
  document.getElementById("editor-path-label")?.replaceChildren(document.createTextNode(filePath));
  renderTabs();
}

function guessLanguage(filePath) {
  const ext = String(filePath || "").split(".").pop()?.toLowerCase() || "";
  const map = {
    js: "javascript",
    jsx: "javascript",
    ts: "typescript",
    tsx: "typescript",
    json: "json",
    html: "html",
    css: "css",
    md: "markdown",
    py: "python",
    yml: "yaml",
    yaml: "yaml",
    sh: "shell",
    cs: "csharp",
  };
  return map[ext] || "plaintext";
}

function loadMonacoScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-monaco-loader="${src}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Monaco loader failed")), { once: true });
      if (window.require) {
        resolve();
      }
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.dataset.monacoLoader = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Monaco loader failed"));
    document.head.appendChild(script);
  });
}

async function initMonacoEditor() {
  if (!monacoEnabled || monacoEditor) {
    return Boolean(monacoEditor);
  }
  const container = getMonacoContainer();
  const textarea = getTextareaEl();
  if (!container || !textarea) {
    return false;
  }
  try {
    await loadMonacoScript("https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs/loader.min.js");
    await new Promise((resolve, reject) => {
      window.require.config({
        paths: { vs: "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs" },
      });
      window.require(["vs/editor/editor.main"], () => resolve(), reject);
    });
    monacoEditor = window.monaco.editor.create(container, {
      value: textarea.value || "",
      language: "plaintext",
      theme: "vs-dark",
      automaticLayout: true,
      minimap: { enabled: false },
      fontSize: 13,
      wordWrap: "on",
    });
    monacoEditor.onDidChangeModelContent(() => {
      if (activeFilePath) {
        setDirty(true);
      }
    });
    textarea.classList.add("hidden");
    container.classList.remove("hidden");
    useMonaco = true;
    appendLog("Monaco editör aktif.");
    return true;
  } catch (error) {
    appendLog(`Monaco yüklenemedi — düz metin editörü kullanılıyor: ${error.message}`);
    container.classList.add("hidden");
    textarea.classList.remove("hidden");
    useMonaco = false;
    return false;
  }
}

function renderFileTree(files) {
  const tree = document.getElementById("file-tree");
  if (!tree) return;
  tree.innerHTML = "";
  const query = String(document.getElementById("file-search")?.value || "").trim().toLowerCase();
  const filtered = query
    ? files.filter((file) => file.toLowerCase().includes(query))
    : files;
  for (const file of filtered) {
    const row = document.createElement("div");
    row.className = "file-item";
    row.textContent = file;
    row.dataset.path = file;
    if (file === activeFilePath) {
      row.classList.add("active");
    }
    row.addEventListener("click", () => void openFile(file, row));
    tree.appendChild(row);
  }
  if (filtered.length === 0) {
    tree.textContent = query ? "Eşleşen dosya yok." : "Dosya yok.";
  }
}

async function loadFileTree() {
  const result = await api.invoke("list-workspace-files", {});
  if (!result?.ok) {
    const tree = document.getElementById("file-tree");
    if (tree) tree.textContent = result?.error || "Dosya listesi alınamadı.";
    return;
  }
  allFiles = result.files || [];
  renderFileTree(allFiles);
}

async function refreshGitPanel() {
  const panel = document.getElementById("git-panel");
  if (!panel) {
    return;
  }
  try {
    const result = await api.invoke("get-workspace-git-summary", {});
    if (!result?.ok) {
      panel.textContent = result?.error || "Git bilgisi yok.";
      return;
    }
    const statusLine = result.isClean
      ? "çalışma alanı temiz"
      : `${result.changedCount} değişiklik`;
    panel.innerHTML = `<strong>${result.branch}</strong> · ${statusLine}${result.statusPreview ? `<br/><span style="opacity:0.85">${result.statusPreview.replace(/\n/g, "<br/>")}</span>` : ""}`;
  } catch (error) {
    panel.textContent = error.message || "Git yüklenemedi.";
  }
}

async function refreshCheckpointButton() {
  const btn = document.getElementById("btn-rollback-checkpoint");
  if (!btn) {
    return;
  }
  try {
    const result = await api.invoke("list-code-checkpoints", {});
    if (result?.ok && Array.isArray(result.checkpoints) && result.checkpoints.length > 0) {
      latestCheckpointId = result.checkpoints[0].id;
      btn.classList.remove("hidden");
      btn.title = `Son checkpoint: ${result.checkpoints[0].label || latestCheckpointId}`;
      return;
    }
    latestCheckpointId = null;
    btn.classList.add("hidden");
  } catch {
    latestCheckpointId = null;
    btn.classList.add("hidden");
  }
}

async function openFile(filePath, rowEl) {
  if (dirty && activeFilePath) {
    const keep = window.confirm("Kaydedilmemiş değişiklikler var. Devam edilsin mi?");
    if (!keep) {
      return;
    }
  }
  syncActiveTabContent();
  document.querySelectorAll(".file-item").forEach((el) => el.classList.remove("active"));
  rowEl?.classList.add("active");
  activeFilePath = filePath;

  if (studioV3Enabled && openTabs.has(filePath)) {
    const tabState = openTabs.get(filePath);
    setEditorContent(tabState.content || "");
    setDirty(Boolean(tabState.dirty));
    if (useMonaco && monacoEditor) {
      const model = monacoEditor.getModel();
      if (model) {
        window.monaco.editor.setModelLanguage(model, guessLanguage(filePath));
      }
    }
    document.getElementById("editor-path-label")?.replaceChildren(document.createTextNode(filePath));
    renderTabs();
    return;
  }

  const result = await api.invoke("read-workspace-file", { filePath });
  if (!result?.ok) {
    setEditorContent(result?.error || "Okunamadı.");
    setDirty(false);
    return;
  }
  setEditorContent(result.content);
  if (useMonaco && monacoEditor) {
    const model = monacoEditor.getModel();
    if (model) {
      window.monaco.editor.setModelLanguage(model, guessLanguage(filePath));
    }
  }
  if (studioV3Enabled) {
    openTabs.set(filePath, { content: result.content, dirty: false });
    renderTabs();
  }
  setDirty(false);
  document.getElementById("editor-path-label")?.replaceChildren(document.createTextNode(filePath));
}

async function saveActiveFile() {
  if (!activeFilePath) {
    appendLog("Kaydedilecek dosya seçilmedi.");
    return;
  }
  const content = getEditorContent();
  const result = await api.invoke("write-workspace-file", {
    filePath: activeFilePath,
    content,
  });
  if (result?.ok) {
    setDirty(false);
    if (studioV3Enabled && openTabs.has(activeFilePath)) {
      openTabs.get(activeFilePath).content = content;
      openTabs.get(activeFilePath).dirty = false;
    }
    appendLog(`Kaydedildi: ${activeFilePath}`);
  } else {
    appendLog(result?.error || "Kaydetme başarısız");
  }
}

document.getElementById("file-search")?.addEventListener("input", () => {
  renderFileTree(allFiles);
});

document.getElementById("btn-save-file")?.addEventListener("click", () => {
  void saveActiveFile();
});

document.getElementById("btn-refresh-git")?.addEventListener("click", () => {
  void refreshGitPanel();
});

document.getElementById("btn-rollback-checkpoint")?.addEventListener("click", async () => {
  if (!latestCheckpointId) {
    appendLog("Geri alınacak checkpoint yok.");
    return;
  }
  const confirmed = window.confirm("Son checkpoint geri alınsın mı?");
  if (!confirmed) {
    return;
  }
  const result = await api.invoke("rollback-code-checkpoint", { checkpointId: latestCheckpointId });
  if (result?.ok) {
    appendLog(`Checkpoint geri alındı (${result.restored?.length || 0} dosya).`);
    void loadFileTree();
    void refreshCheckpointButton();
  } else {
    appendLog(result?.error || "Checkpoint geri alınamadı.");
  }
});

getTextareaEl()?.addEventListener("input", () => {
  if (activeFilePath && !useMonaco) {
    setDirty(true);
  }
});

document.getElementById("btn-refresh-index")?.addEventListener("click", async () => {
  appendLog("İndeks yenileniyor…");
  const result = await api.invoke("index-workspace-code", {});
  appendLog(result?.ok ? `İndeks tamam (${result.fileCount} dosya)` : (result?.error || "Hata"));
  void loadFileTree();
});

document.getElementById("btn-code-agent-cancel-studio")?.addEventListener("click", async () => {
  appendLog("Kod agent durduruluyor…");
  const result = await api.invoke("code-agent-cancel", {});
  appendLog(result?.ok ? "Agent durduruldu" : (result?.error || "Durdurulamadı"));
});

api.on("code-agent-step-updated", (payload) => {
  appendLog(`Adım: ${payload?.tool || payload?.phase || "—"} ${payload?.message || ""}`);
});

api.on("code-agent-diff-pending", (payload) => {
  appendLog(`Onay bekliyor: ${payload?.path || "dosya"}`);
  const diffEl = document.getElementById("pending-diff");
  if (diffEl) {
    diffEl.textContent = String(payload?.diff || "").slice(0, 6000);
  }
});

api.on("code-agent-complete", (payload) => {
  appendLog(`Tamamlandı: ${payload?.summary || ""}`);
  void loadFileTree();
  void refreshGitPanel();
  void refreshCheckpointButton();
});

api.on("code-agent-error", (payload) => {
  appendLog(`Hata: ${payload?.error || "bilinmiyor"}`);
});

async function bootstrap() {
  try {
    const settings = await api.invoke("get-settings");
    monacoEnabled = settings?.codeStudioMonacoEnabled !== false;
    studioV3Enabled = settings?.codeStudioV3Enabled !== false;
  } catch {
    monacoEnabled = true;
    studioV3Enabled = true;
  }
  if (monacoEnabled) {
    await initMonacoEditor();
  }
  await loadFileTree();
  await refreshGitPanel();
  await refreshCheckpointButton();
}

void bootstrap();
