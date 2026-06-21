const path = require("path");
const { contextBridge, ipcRenderer } = require("electron");

const {
  PRELOAD_ON_CHANNELS,
  PRELOAD_SEND_CHANNELS,
} = require(path.join(__dirname, "src", "ipc", "channel-registry"));

const pkg = require("./package.json");
const publisherName = typeof pkg.author === "string" ? pkg.author : pkg.author?.name || "";

const api = {
  invoke: (ch, ...a) => ipcRenderer.invoke(ch, ...a),
  on: (ch, cb) => {
    if (!PRELOAD_ON_CHANNELS.includes(ch)) return;
    const fn = (_e, ...a) => cb(...a);
    ipcRenderer.on(ch, fn);
    return () => ipcRenderer.removeListener(ch, fn);
  },
  send: (ch, ...a) => {
    if (PRELOAD_SEND_CHANNELS.includes(ch)) ipcRenderer.send(ch, ...a);
  },
};

contextBridge.exposeInMainWorld("sauron", api);
contextBridge.exposeInMainWorld("openguider", api);
contextBridge.exposeInMainWorld("sauronAppInfo", {
  name: pkg.build?.productName || "Sauron",
  version: pkg.version,
  publisher: publisherName,
});
