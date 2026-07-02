const fs = require("fs");
const os = require("os");
const path = require("path");

const defaultAsar = path.join(
  process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"),
  "Programs",
  "Sauron",
  "resources",
  "app.asar",
);
const asarPath = process.argv[2] || defaultAsar;

if (!fs.existsSync(asarPath)) {
  console.error(`app.asar not found: ${asarPath}`);
  process.exit(1);
}

const text = fs.readFileSync(asarPath).toString("latin1");
const version = text.match(/"version"\s*:\s*"([^"]+)"/);
console.log("asar:", asarPath);
console.log("version:", version?.[1] || "unknown");

const bootIdx = text.indexOf("app.whenReady");
if (bootIdx < 0) {
  console.error("app.whenReady block not found in asar");
  process.exit(1);
}

const boot = text.slice(bootIdx, bootIdx + 12000);
const ipcReadyIdx = boot.indexOf("ensureIpcHandlersReady()");
const setupIdx = boot.indexOf("setupIPC()");
const panelIdx = boot.indexOf("createPanelWindow()");
const registerIdx = boot.indexOf("registerPanelOpenIpc()");
const barrierIdx = boot.indexOf("ipcHandlersReady");

const orderOk = (ipcReadyIdx > -1 && panelIdx > -1 && ipcReadyIdx < panelIdx)
  || (setupIdx > -1 && panelIdx > -1 && setupIdx < panelIdx);
console.log("registerPanelOpenIpc index:", registerIdx);
console.log("ensureIpcHandlersReady index:", ipcReadyIdx);
console.log("setupIPC index:", setupIdx);
console.log("createPanelWindow index:", panelIdx);
console.log("ipcHandlersReady barrier present:", barrierIdx > -1);
console.log("IPC handlers before panel window:", orderOk);

if (!orderOk) {
  console.error("FAIL: installed build has IPC startup race (panel before handlers)");
  process.exit(1);
}

console.log("OK: installed build IPC startup order looks correct");
