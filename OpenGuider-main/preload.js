const { contextBridge, ipcRenderer } = require("electron");

const { PRELOAD_ON_CHANNELS, PRELOAD_SEND_CHANNELS } = require("./src/ipc/channel-registry");

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

contextBridge.exposeInMainWorld("openguider", api);
contextBridge.exposeInMainWorld("sauron", api);
