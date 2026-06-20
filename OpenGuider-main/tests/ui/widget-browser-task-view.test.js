const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");
const { pathToFileURL } = require("url");

function createApiMock({ settings, session }) {
  const listeners = new Map();

  return {
    api: {
      invoke: async (channel) => {
        if (channel === "get-settings") return settings;
        if (channel === "get-active-session") return session;
        if (channel === "set-widget-expanded") return true;
        if (channel === "set-widget-height") return true;
        if (channel === "show-main") return true;
        if (channel === "open-openguider") return true;
        return true;
      },
      on(channel, cb) {
        if (!listeners.has(channel)) {
          listeners.set(channel, []);
        }
        listeners.get(channel).push(cb);
        return () => {
          const next = (listeners.get(channel) || []).filter((entry) => entry !== cb);
          listeners.set(channel, next);
        };
      },
      send() {},
    },
    emit(channel, payload) {
      for (const listener of listeners.get(channel) || []) {
        listener(payload);
      }
    },
  };
}

async function importModule(relativePath) {
  return import(pathToFileURL(path.join(__dirname, relativePath)).href);
}

test("widget hides guide controls during browser execution and restores them afterward", async () => {
  const html = fs.readFileSync(path.join(__dirname, "../../renderer/widget.html"), "utf8");
  const dom = new JSDOM(html, { url: "http://localhost" });
  global.window = dom.window;
  global.document = dom.window.document;
  dom.window.requestAnimationFrame = (cb) => dom.window.setTimeout(cb, 0);
  dom.window.cancelAnimationFrame = (id) => dom.window.clearTimeout(id);

  const settings = {
    assistantMode: "planning",
  };
  const session = {
    activePlan: null,
    browserExecution: {
      taskId: "task-1",
      goal: "Open checkout",
      mode: "auto",
      trustLevel: "autopilot",
      status: "running",
      startedAt: "2026-04-24T10:00:00.000Z",
      substeps: [],
      finalMessage: "",
    },
    status: "executing",
  };
  const { api, emit } = createApiMock({ settings, session });
  const { createTaskWidgetController } = await importModule("../../renderer/js/widget/task-widget.js");

  try {
    const controller = createTaskWidgetController({ api, doc: dom.window.document });
    await controller.init();

    const widget = dom.window.document.getElementById("widget");
    const statusText = dom.window.document.getElementById("status-text");
    const goalText = dom.window.document.getElementById("goal-text");
    const browserProgress = dom.window.document.getElementById("browser-progress");
    const btnShowPlan = dom.window.document.getElementById("btn-show-plan");
    const actionRow = dom.window.document.getElementById("action-row");

    assert.equal(widget.classList.contains("browser-exec-active"), true);
    assert.equal(statusText.textContent, "browser");
    assert.equal(goalText.textContent, "Open checkout");
    assert.equal(browserProgress.textContent, "step 0");
    assert.equal(browserProgress.classList.contains("hidden"), false);
    assert.equal(btnShowPlan.classList.contains("hidden"), true);
    assert.equal(actionRow.classList.contains("hidden"), false);

    emit("session-updated", {
      activePlan: {
        goal: "Guide task",
        currentStepIndex: 0,
        steps: [
          {
            id: "step_1",
            title: "Step one",
            instruction: "Do the guide step",
          },
        ],
      },
      browserExecution: null,
      status: "waiting_user",
    });

    assert.equal(widget.classList.contains("browser-exec-active"), false);
    assert.equal(btnShowPlan.classList.contains("hidden"), false);
    assert.equal(browserProgress.classList.contains("hidden"), true);
    assert.equal(goalText.textContent, "Guide task");
  } finally {
    delete global.window;
    delete global.document;
    dom.window.close();
  }
});

test("widget expand opens assistant panel via open-openguider", async () => {
  const html = fs.readFileSync(path.join(__dirname, "../../renderer/widget.html"), "utf8");
  const dom = new JSDOM(html, { url: "http://localhost" });
  global.window = dom.window;
  global.document = dom.window.document;
  dom.window.requestAnimationFrame = (cb) => dom.window.setTimeout(cb, 0);
  dom.window.cancelAnimationFrame = (id) => dom.window.clearTimeout(id);

  const invoked = [];
  const api = {
    invoke: async (channel, meta) => {
      invoked.push({ channel, meta });
      if (channel === "get-settings") return { assistantMode: "planning" };
      if (channel === "get-active-session") return { activePlan: null, status: "idle" };
      if (channel === "set-widget-expanded") return true;
      if (channel === "open-openguider") return true;
      if (channel === "show-main") return true;
      return true;
    },
    on() {
      return () => {};
    },
    send() {},
  };
  const { createTaskWidgetController } = await importModule("../../renderer/js/widget/task-widget.js");

  try {
    const controller = createTaskWidgetController({ api, doc: dom.window.document });
    await controller.init();
    const btnShowPlan = dom.window.document.getElementById("btn-show-plan");
    btnShowPlan.dispatchEvent(new dom.window.MouseEvent("pointerup", { bubbles: true, cancelable: true }));
    await new Promise((resolve) => dom.window.setTimeout(resolve, 0));

    const openCalls = invoked.filter((entry) => entry.channel === "open-openguider");
    assert.equal(openCalls.length, 1);
    assert.equal(openCalls[0].meta?.source, "widget-expand");
  } finally {
    delete global.window;
    delete global.document;
    dom.window.close();
  }
});

test("widget open button falls back to show-main when open-openguider fails", async () => {
  const html = fs.readFileSync(path.join(__dirname, "../../renderer/widget.html"), "utf8");
  const dom = new JSDOM(html, { url: "http://localhost" });
  global.window = dom.window;
  global.document = dom.window.document;
  dom.window.requestAnimationFrame = (cb) => dom.window.setTimeout(cb, 0);
  dom.window.cancelAnimationFrame = (id) => dom.window.clearTimeout(id);

  const invoked = [];
  const api = {
    invoke: async (channel) => {
      invoked.push(channel);
      if (channel === "get-settings") return { assistantMode: "planning" };
      if (channel === "get-active-session") return { activePlan: null, status: "idle" };
      if (channel === "set-widget-expanded") return true;
      if (channel === "open-openguider") throw new Error("missing handler");
      if (channel === "show-main") return true;
      return true;
    },
    on() {
      return () => {};
    },
    send() {},
  };
  const { createTaskWidgetController } = await importModule("../../renderer/js/widget/task-widget.js");

  try {
    const controller = createTaskWidgetController({ api, doc: dom.window.document });
    await controller.init();
    const opened = await dom.window.__openOpenGuider();
    assert.equal(opened, true);
    assert.deepEqual(
      invoked.filter((channel) => channel === "open-openguider" || channel === "show-main"),
      ["open-openguider", "show-main"],
    );
  } finally {
    delete global.window;
    delete global.document;
    dom.window.close();
  }
});
