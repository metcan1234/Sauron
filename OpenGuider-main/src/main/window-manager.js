function createWindowManager({
  BrowserWindow,
  screen,
  path,
  fs,
  nativeImage,
  appLogger,
  preloadPath,
  rendererDir,
  constants,
  getRefs,
  setRefs,
  callbacks,
}) {
  const {
    PANEL_WIDTH,
    PANEL_HEIGHT,
    WIDGET_WIDTH,
    WIDGET_COLLAPSED_HEIGHT,
  } = constants;

  function getVirtualDisplayBounds() {
    const displays = screen.getAllDisplays();
    const left = Math.min(...displays.map((display) => display.bounds.x));
    const top = Math.min(...displays.map((display) => display.bounds.y));
    const right = Math.max(...displays.map((display) => display.bounds.x + display.bounds.width));
    const bottom = Math.max(...displays.map((display) => display.bounds.y + display.bounds.height));
    return {
      x: left,
      y: top,
      width: right - left,
      height: bottom - top,
    };
  }

  function resizeCursorOverlayToVirtualBounds() {
    const { cursorOverlayWindow } = getRefs();
    if (!cursorOverlayWindow || cursorOverlayWindow.isDestroyed()) {
      return;
    }
    cursorOverlayWindow.setBounds(getVirtualDisplayBounds());
  }

  function attachWindowCrashHandlers(windowRef, name) {
    if (!windowRef || windowRef.isDestroyed()) {
      return;
    }

    windowRef.webContents.on("render-process-gone", (_event, details) => {
      appLogger.error("renderer-process-gone", {
        window: name,
        reason: details?.reason,
        exitCode: details?.exitCode,
      });

      if (name === "widget") {
        setTimeout(() => {
          const refs = getRefs();
          try {
            if (refs.widgetWindow && !refs.widgetWindow.isDestroyed()) {
              refs.widgetWindow.destroy();
            }
          } catch (destroyError) {
            appLogger.warn("widget-crash-destroy-failed", { error: destroyError });
          }
          setRefs({ widgetWindow: null });
          ensureWidgetWindow();
          const recoveredWidget = getRefs().widgetWindow;
          if (recoveredWidget && !recoveredWidget.isDestroyed()) {
            recoveredWidget.show();
          }
        }, 400);
        return;
      }

      if (name === "cursor-overlay") {
        setTimeout(() => {
          const refs = getRefs();
          try {
            if (refs.cursorOverlayWindow && !refs.cursorOverlayWindow.isDestroyed()) {
              refs.cursorOverlayWindow.destroy();
            }
          } catch (destroyError) {
            appLogger.warn("cursor-overlay-crash-destroy-failed", { error: destroyError });
          }
          setRefs({ cursorOverlayWindow: null });
        }, 400);
        return;
      }

      if (name === "panel") {
        const wasVisible = getRefs().isPanelVisible;
        setTimeout(() => {
          const refs = getRefs();
          try {
            if (refs.panelWindow && !refs.panelWindow.isDestroyed()) {
              refs.panelWindow.destroy();
            }
          } catch (destroyError) {
            appLogger.warn("panel-crash-destroy-failed", { error: destroyError });
          }
          setRefs({ panelWindow: null });
          if (typeof callbacks.recreatePanelWindow === "function") {
            callbacks.recreatePanelWindow();
          } else {
            createPanelWindow();
          }
          if (wasVisible && typeof callbacks.showPanel === "function") {
            callbacks.showPanel();
          }
          if (typeof callbacks.broadcastSessionSnapshot === "function") {
            callbacks.broadcastSessionSnapshot();
          }
          appLogger.info("panel-renderer-recovered", { wasVisible });
        }, 400);
        return;
      }

      if (name === "settings") {
        setTimeout(() => {
          const refs = getRefs();
          try {
            if (refs.settingsWindow && !refs.settingsWindow.isDestroyed()) {
              refs.settingsWindow.destroy();
            }
          } catch (destroyError) {
            appLogger.warn("settings-crash-destroy-failed", { error: destroyError });
          }
          setRefs({ settingsWindow: null });
          createSettingsWindow();
          appLogger.info("settings-renderer-recovered");
        }, 400);
      }
    });

    windowRef.webContents.on("unresponsive", () => {
      appLogger.warn("renderer-unresponsive", { window: name });
    });
  }

  const PRELOAD_WEB_PREFERENCES = {
    preload: preloadPath,
    nodeIntegration: false,
    contextIsolation: true,
    sandbox: false,
  };

  function createPanelWindow() {
    const panelWindow = new BrowserWindow({
      width: PANEL_WIDTH,
      height: PANEL_HEIGHT,
      frame: false,
      transparent: false,
      backgroundColor: "#0a0a0a",
      resizable: false,
      show: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      webPreferences: PRELOAD_WEB_PREFERENCES,
    });
    panelWindow.loadFile(path.join(rendererDir, "index.html"));
    panelWindow.webContents.on("did-finish-load", () => {
      if (typeof callbacks.onPanelReady === "function") {
        callbacks.onPanelReady();
      }
    });
    panelWindow.on("hide", () => {
      if (typeof callbacks.onPanelHide === "function") {
        callbacks.onPanelHide();
      }
    });
    attachWindowCrashHandlers(panelWindow, "panel");
    setRefs({ panelWindow });
  }

  function createSettingsWindow() {
    const refs = getRefs();
    if (refs.settingsWindow && !refs.settingsWindow.isDestroyed()) {
      refs.settingsWindow.focus();
      return;
    }

    const settingsWindow = new BrowserWindow({
      width: 600,
      height: 700,
      frame: false,
      transparent: true,
      resizable: false,
      skipTaskbar: false,
      alwaysOnTop: false,
      parent: refs.panelWindow,
      webPreferences: PRELOAD_WEB_PREFERENCES,
    });
    settingsWindow.loadFile(path.join(rendererDir, "settings.html"));
    attachWindowCrashHandlers(settingsWindow, "settings");
    settingsWindow.on("closed", () => {
      setRefs({ settingsWindow: null });
    });
    setRefs({ settingsWindow });
  }

  function createCodeStudioWindow() {
    const refs = getRefs();
    if (refs.codeStudioWindow && !refs.codeStudioWindow.isDestroyed()) {
      refs.codeStudioWindow.focus();
      return;
    }

    const codeStudioWindow = new BrowserWindow({
      width: 960,
      height: 640,
      frame: true,
      resizable: true,
      skipTaskbar: false,
      alwaysOnTop: false,
      parent: refs.panelWindow,
      webPreferences: PRELOAD_WEB_PREFERENCES,
    });
    codeStudioWindow.setTitle("Sauron Code Studio");
    codeStudioWindow.loadFile(path.join(rendererDir, "code-studio.html"));
    attachWindowCrashHandlers(codeStudioWindow, "code-studio");
    codeStudioWindow.on("closed", () => {
      setRefs({ codeStudioWindow: null });
    });
    setRefs({ codeStudioWindow });
  }

  function createCursorOverlay() {
    const virtualBounds = getVirtualDisplayBounds();
    const cursorOverlayWindow = new BrowserWindow({
      width: virtualBounds.width,
      height: virtualBounds.height,
      x: virtualBounds.x,
      y: virtualBounds.y,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      focusable: false,
      show: false,
      webPreferences: PRELOAD_WEB_PREFERENCES,
    });
    cursorOverlayWindow.setAlwaysOnTop(true, "screen-saver", 1);
    cursorOverlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    cursorOverlayWindow.setIgnoreMouseEvents(true, { forward: true });
    cursorOverlayWindow.loadFile(path.join(rendererDir, "cursor.html"));
    attachWindowCrashHandlers(cursorOverlayWindow, "cursor-overlay");
    screen.on("display-added", resizeCursorOverlayToVirtualBounds);
    screen.on("display-removed", resizeCursorOverlayToVirtualBounds);
    screen.on("display-metrics-changed", resizeCursorOverlayToVirtualBounds);
    setRefs({ cursorOverlayWindow });
  }

  function ensureCursorOverlay() {
    const refs = getRefs();
    if (!refs.cursorOverlayWindow || refs.cursorOverlayWindow.isDestroyed()) {
      createCursorOverlay();
    }
    return getRefs().cursorOverlayWindow;
  }

  function createWidgetWindow() {
    const refs = getRefs();
    if (refs.widgetWindow && !refs.widgetWindow.isDestroyed()) {
      return;
    }

    const widgetWindow = new BrowserWindow({
      width: WIDGET_WIDTH,
      height: WIDGET_COLLAPSED_HEIGHT,
      frame: false,
      transparent: true,
      resizable: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      webPreferences: PRELOAD_WEB_PREFERENCES,
    });

    widgetWindow.loadFile(path.join(rendererDir, "widget.html"));
    attachWindowCrashHandlers(widgetWindow, "widget");

    const cursorPt = screen.getCursorScreenPoint();
    const activeDisplay = screen.getDisplayNearestPoint(cursorPt);
    const wa = activeDisplay.workArea;
    const margin = 16;
    const x = Math.max(wa.x + margin, wa.x + wa.width - WIDGET_WIDTH - margin);
    const y = wa.y + margin;
    widgetWindow.setPosition(x, y);
    widgetWindow.on("closed", () => {
      setRefs({ widgetWindow: null });
    });
    setRefs({ widgetWindow });
  }

  function ensureWidgetWindow() {
    const refs = getRefs();
    if (!refs.widgetWindow || refs.widgetWindow.isDestroyed()) {
      createWidgetWindow();
    }
    return getRefs().widgetWindow;
  }

  function positionWidgetBottomRight(nextHeight) {
    const widgetWindow = getRefs().widgetWindow;
    if (!widgetWindow || widgetWindow.isDestroyed()) {
      return;
    }

    const [wx, wy] = widgetWindow.getPosition();
    const { workArea: wa } = screen.getDisplayNearestPoint({ x: wx, y: wy });
    const x = wa.x + wa.width - WIDGET_WIDTH - 20;
    const y = wa.y + wa.height - nextHeight - 20;
    widgetWindow.setPosition(x, y);
  }

  function resizeWidgetPreservingPosition(nextHeight) {
    const widgetWindow = getRefs().widgetWindow;
    if (!widgetWindow || widgetWindow.isDestroyed()) {
      return;
    }

    const [x, y] = widgetWindow.getPosition();
    widgetWindow.setBounds({
      x,
      y,
      width: WIDGET_WIDTH,
      height: nextHeight,
    });
  }

  function buildTrayIcon() {
    const logoPath = path.join(rendererDir, "assets", "logo.png");
    if (fs.existsSync(logoPath)) {
      const logoIcon = nativeImage.createFromPath(logoPath);
      if (!logoIcon.isEmpty()) {
        return logoIcon;
      }
    }

    const size = 32;
    const data = Buffer.alloc(size * size * 4);
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const idx = (y * size + x) * 4;
        const dx = x - size / 2;
        const dy = y - size / 2;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= size / 2 - 2) {
          data[idx] = 124;
          data[idx + 1] = 58;
          data[idx + 2] = 237;
          data[idx + 3] = 255;
        }
      }
    }
    return nativeImage.createFromBuffer(data, { width: size, height: size });
  }

  return {
    attachWindowCrashHandlers,
    createPanelWindow,
    createSettingsWindow,
    createCodeStudioWindow,
    createWidgetWindow,
    createCursorOverlay,
    ensureCursorOverlay,
    ensureWidgetWindow,
    getVirtualDisplayBounds,
    resizeCursorOverlayToVirtualBounds,
    positionWidgetBottomRight,
    resizeWidgetPreservingPosition,
    buildTrayIcon,
  };
}

module.exports = { createWindowManager };
