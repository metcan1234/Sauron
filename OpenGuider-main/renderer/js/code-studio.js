const api = window.sauron;

function appendLog(line) {
  const el = document.getElementById("agent-log");
  if (!el) return;
  const ts = new Date().toLocaleTimeString("tr-TR");
  el.textContent = `${ts} — ${line}\n` + el.textContent;
}

async function loadFileTree() {
  const tree = document.getElementById("file-tree");
  const result = await api.invoke("list-workspace-files", {});
  if (!result?.ok) {
    if (tree) tree.textContent = result?.error || "Dosya listesi alınamadı.";
    return;
  }
  if (!tree) return;
  tree.innerHTML = "";
  for (const file of result.files || []) {
    const row = document.createElement("div");
    row.className = "file-item";
    row.textContent = file;
    row.addEventListener("click", () => void openFile(file, row));
    tree.appendChild(row);
  }
}

async function openFile(filePath, rowEl) {
  document.querySelectorAll(".file-item").forEach((el) => el.classList.remove("active"));
  rowEl?.classList.add("active");
  const result = await api.invoke("read-workspace-file", { filePath });
  const pre = document.getElementById("file-content");
  if (!pre) return;
  if (!result?.ok) {
    pre.textContent = result?.error || "Okunamadı.";
    return;
  }
  pre.textContent = result.content;
}

document.getElementById("btn-refresh-index")?.addEventListener("click", async () => {
  appendLog("İndeks yenileniyor…");
  const result = await api.invoke("index-workspace-code", {});
  appendLog(result?.ok ? `İndeks tamam (${result.fileCount} dosya)` : (result?.error || "Hata"));
});

api.on("code-agent-step-updated", (payload) => {
  appendLog(`Adım: ${payload?.tool || payload?.phase || "—"} ${payload?.message || ""}`);
});

api.on("code-agent-diff-pending", (payload) => {
  appendLog(`Onay bekliyor: ${payload?.path || "dosya"}`);
});

api.on("code-agent-complete", (payload) => {
  appendLog(`Tamamlandı: ${payload?.summary || ""}`);
  void loadFileTree();
});

api.on("code-agent-error", (payload) => {
  appendLog(`Hata: ${payload?.error || "bilinmiyor"}`);
});

void loadFileTree();
