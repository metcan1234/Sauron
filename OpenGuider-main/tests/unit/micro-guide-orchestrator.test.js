const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { EventEmitter } = require("events");

const { SessionManager } = require("../../src/session/session-manager");

function createMockIpcMain() {
  const emitter = new EventEmitter();
  return {
    emit: emitter.emit.bind(emitter),
    on: emitter.on.bind(emitter),
    removeListener: emitter.removeListener.bind(emitter),
  };
}

function withMockedTaskOrchestrator(moduleOverrides, callback) {
  const taskPath = require.resolve("../../src/agent/task-orchestrator");
  const electronPath = require.resolve("electron");
  const originalTaskModule = require.cache[taskPath];
  const originalElectronExports = require(electronPath);
  const restoredModules = [];
  const ipcMain = createMockIpcMain();

  try {
    require.cache[electronPath].exports = {
      ...originalElectronExports,
      ipcMain,
    };

    for (const [relativePath, exportsOverride] of Object.entries(moduleOverrides)) {
      const absolutePath = require.resolve(relativePath);
      const originalExports = require(absolutePath);
      require.cache[absolutePath].exports = {
        ...originalExports,
        ...exportsOverride,
      };
      restoredModules.push({ absolutePath, originalExports });
    }

    delete require.cache[taskPath];
    const { TaskOrchestrator: MockedTaskOrchestrator } = require(taskPath);
    return callback({ TaskOrchestrator: MockedTaskOrchestrator, ipcMain });
  } finally {
    delete require.cache[taskPath];
    require.cache[electronPath].exports = originalElectronExports;
    for (const { absolutePath, originalExports } of restoredModules) {
      require.cache[absolutePath].exports = originalExports;
    }
    if (originalTaskModule) {
      require.cache[taskPath] = originalTaskModule;
    }
  }
}

const sampleImages = [{ base64Jpeg: "abc", width: 100, height: 100 }];

test("session manager micro guide helpers track turns and snapshot", () => {
  const sessionManager = new SessionManager();
  sessionManager.startMicroGuideSession({ goal: "Open WhatsApp", maxTurns: 3 });
  sessionManager.setMicroGuideLastInstruction("Başlat menüsüne tıklayın");
  sessionManager.incrementMicroGuideTurn();
  sessionManager.setMicroGuideStatus("waiting_user");

  const snapshot = sessionManager.getSnapshot();
  assert.equal(snapshot.microGuideSession.active, true);
  assert.equal(snapshot.microGuideSession.turnCount, 1);
  assert.equal(snapshot.microGuideSession.maxTurns, 3);
  assert.equal(snapshot.microGuideSession.status, "waiting_user");

  sessionManager.clearMicroGuideSession();
  assert.equal(sessionManager.getSnapshot().microGuideSession, null);
});

test("startMicroGuideSession rejects when planned guide is active", async () => {
  await withMockedTaskOrchestrator({}, async ({ TaskOrchestrator }) => {
    const sessionManager = new SessionManager();
    const orchestrator = new TaskOrchestrator({
      captureAllScreens: async () => sampleImages,
      sessionManager,
      prePostLayersEnabled: false,
    });

    sessionManager.setActivePlan({
      goal: "Plan",
      currentStepIndex: 0,
      steps: [{ id: "s1", title: "Step", instruction: "Do", successCriteria: "Done" }],
      status: "active",
    });

    await assert.rejects(
      () => orchestrator.startMicroGuideSession({
        goal: "WhatsApp",
        images: sampleImages,
        settings: {},
        signal: null,
      }),
      /planlı rehber/i,
    );
  });
});

test("startMicroGuideSession runs first instruct turn and sets waiting_user", async () => {
  await withMockedTaskOrchestrator({
    "../../src/agent/micro-guide/micro-guide-instructor": {
      instructMicroGuideTurn: async () => ({
        chatMessage: "Başlat menüsüne tıklayın",
        pointer: { x: 100, y: 200, label: "Başlat" },
        shouldPoint: true,
        isTaskComplete: false,
        typeHint: null,
      }),
    },
  }, async ({ TaskOrchestrator }) => {
    const sessionManager = new SessionManager();
    const orchestrator = new TaskOrchestrator({
      captureAllScreens: async () => sampleImages,
      sessionManager,
      prePostLayersEnabled: false,
    });

    const result = await orchestrator.startMicroGuideSession({
      goal: "WhatsApp nerede?",
      images: sampleImages,
      settings: {},
      signal: null,
    });

    assert.match(result.assistantMessage, /Başlat menüsüne/);
    assert.equal(result.pointer.shouldPoint, true);
    assert.equal(result.session.microGuideSession.turnCount, 1);
    assert.equal(result.session.microGuideSession.status, "waiting_user");
    assert.equal(result.session.status, "waiting_user");
  });
});

test("ackMicroGuide completes session when instructor marks task complete", async () => {
  await withMockedTaskOrchestrator({
    "../../src/agent/micro-guide/micro-guide-instructor": {
      instructMicroGuideTurn: async ({ turnNumber }) => ({
        chatMessage: turnNumber === 1 ? "İlk adım" : "Tamam",
        pointer: null,
        shouldPoint: false,
        isTaskComplete: turnNumber > 1,
        typeHint: null,
      }),
    },
  }, async ({ TaskOrchestrator }) => {
    const sessionManager = new SessionManager();
    const orchestrator = new TaskOrchestrator({
      captureAllScreens: async () => sampleImages,
      sessionManager,
      prePostLayersEnabled: false,
    });

    await orchestrator.startMicroGuideSession({
      goal: "Test",
      images: sampleImages,
      settings: {},
      signal: null,
    });

    const result = await orchestrator.ackMicroGuide({
      images: sampleImages,
      settings: {},
      signal: null,
    });

    assert.equal(result.microGuideComplete, true);
    assert.equal(result.session.microGuideSession, null);
    assert.equal(result.session.status, "idle");
  });
});

test("ackMicroGuide returns limit message when max turns reached", async () => {
  await withMockedTaskOrchestrator({
    "../../src/agent/micro-guide/micro-guide-instructor": {
      instructMicroGuideTurn: async () => ({
        chatMessage: "Adım",
        pointer: null,
        shouldPoint: false,
        isTaskComplete: false,
        typeHint: null,
      }),
    },
  }, async ({ TaskOrchestrator }) => {
    const sessionManager = new SessionManager();
    const orchestrator = new TaskOrchestrator({
      captureAllScreens: async () => sampleImages,
      sessionManager,
      prePostLayersEnabled: false,
    });

    sessionManager.startMicroGuideSession({ goal: "Test", maxTurns: 1 });
    sessionManager.incrementMicroGuideTurn();
    sessionManager.setMicroGuideStatus("waiting_user");
    sessionManager.setStatus("waiting_user");

    const result = await orchestrator.ackMicroGuide({
      images: sampleImages,
      settings: {},
      signal: null,
    });

    assert.equal(result.limitReached, true);
    assert.match(result.assistantMessage, /devam etmek/i);
    assert.equal(result.session.microGuideSession.status, "limit_reached");
  });
});

test("startGoalSession rejects when micro guide is active", async () => {
  await withMockedTaskOrchestrator({}, async ({ TaskOrchestrator }) => {
    const sessionManager = new SessionManager();
    const orchestrator = new TaskOrchestrator({
      captureAllScreens: async () => sampleImages,
      sessionManager,
      prePostLayersEnabled: false,
    });

    sessionManager.startMicroGuideSession({ goal: "WhatsApp" });

    await assert.rejects(
      () => orchestrator.startGoalSession({
        text: "Plan something",
        images: sampleImages,
        settings: { assistantMode: "guide" },
        signal: null,
      }),
      /mikro rehber/i,
    );
  });
});

test("micro guide modules do not use setInterval polling", () => {
  const files = [
    "../../src/agent/micro-guide/detect-micro-guide-intent.js",
    "../../src/agent/micro-guide/micro-guide-instructor.js",
    "../../src/agent/micro-guide/micro-guide-constants.js",
    "../../src/ipc/micro-guide-ipc.js",
  ];

  for (const relativePath of files) {
    const absolutePath = path.join(__dirname, relativePath);
    const source = fs.readFileSync(absolutePath, "utf8");
    assert.equal(source.includes("setInterval"), false, `${relativePath} must not use setInterval`);
  }

  const orchestratorSource = fs.readFileSync(
    path.join(__dirname, "../../src/agent/task-orchestrator.js"),
    "utf8",
  );
  assert.equal(
    orchestratorSource.includes("startMicroGuideSession"),
    true,
    "orchestrator should define micro guide entry points",
  );
});
