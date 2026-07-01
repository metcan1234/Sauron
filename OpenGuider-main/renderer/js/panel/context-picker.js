export function createContextPickerController({ api, doc, dom, log, state }) {
  const pickerEl = doc.getElementById("context-picker-list");
  let filesCache = [];
  let debounceId = null;
  let extendedEnabled = true;

  async function refreshFiles() {
    try {
      const result = await api.invoke("list-workspace-files", {});
      filesCache = result?.ok ? (result.files || []) : [];
    } catch (error) {
      log?.("context-picker files error", error);
      filesCache = [];
    }
  }

  async function refreshSettings() {
    try {
      const settings = state?.getSettings?.() || await api.invoke("get-settings");
      extendedEnabled = settings?.panelExtendedContextEnabled !== false;
    } catch {
      extendedEnabled = true;
    }
  }

  function hide() {
    pickerEl?.classList.add("hidden");
    pickerEl?.replaceChildren();
  }

  function collectFolderMatches(needle) {
    const folders = new Set();
    for (const file of filesCache) {
      const parts = String(file).split("/");
      if (parts.length > 1) {
        folders.add(parts[0]);
      }
    }
    return [...folders]
      .filter((folder) => folder.toLowerCase().includes(needle))
      .slice(0, 6)
      .map((folder) => ({ type: "folder", value: `folder:${folder}`, label: `@folder:${folder}` }));
  }

  function showMatches(query) {
    if (!pickerEl) {
      return;
    }
    const atIndex = query.lastIndexOf("@");
    if (atIndex < 0) {
      hide();
      return;
    }
    const needle = query.slice(atIndex + 1).toLowerCase();
    if (needle.includes(" ")) {
      hide();
      return;
    }

    const virtual = [];
    if (extendedEnabled) {
      if ("git-diff".startsWith(needle) || "git".startsWith(needle) && needle.length <= 4) {
        virtual.push({ type: "virtual", value: "git-diff", label: "@git-diff (değişiklik özeti)" });
      }
      if ("folder".startsWith(needle) || needle.startsWith("folder:")) {
        const folderNeedle = needle.startsWith("folder:") ? needle.slice(7) : needle.replace(/^folder/, "");
        if (folderNeedle && folderNeedle !== "folder") {
          virtual.push(...collectFolderMatches(folderNeedle));
        } else {
          virtual.push({ type: "virtual", value: "folder", label: "@folder (kök klasörler)" });
          virtual.push(...collectFolderMatches(""));
        }
      }
    }

    const matches = filesCache
      .filter((file) => file.toLowerCase().includes(needle))
      .slice(0, 8);

    if (virtual.length === 0 && matches.length === 0) {
      hide();
      return;
    }

    pickerEl.replaceChildren();
    for (const entry of virtual) {
      const row = doc.createElement("button");
      row.type = "button";
      row.className = "context-picker-item context-picker-item-virtual";
      row.textContent = entry.label;
      row.addEventListener("click", () => {
        const before = query.slice(0, atIndex);
        dom.textInput.value = `${before}@${entry.value} `;
        hide();
        dom.textInput.focus();
      });
      pickerEl.appendChild(row);
    }
    for (const file of matches) {
      const row = doc.createElement("button");
      row.type = "button";
      row.className = "context-picker-item";
      row.textContent = `@${file}`;
      row.addEventListener("click", () => {
        const before = query.slice(0, atIndex);
        dom.textInput.value = `${before}@${file} `;
        hide();
        dom.textInput.focus();
      });
      pickerEl.appendChild(row);
    }
    pickerEl.classList.remove("hidden");
  }

  function bind(textInput) {
    if (!textInput) {
      return;
    }
    void refreshFiles();
    void refreshSettings();
    textInput.addEventListener("input", () => {
      clearTimeout(debounceId);
      debounceId = window.setTimeout(() => {
        showMatches(textInput.value);
      }, 120);
    });
    textInput.addEventListener("blur", () => {
      window.setTimeout(() => hide(), 160);
    });
  }

  return { bind, refreshFiles, refreshSettings, hide };
}
