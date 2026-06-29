#!/usr/bin/env node
const { execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

function readWorkspaceFromConfig() {
  const configPath = path.join(process.env.APPDATA || "", "openguider", "config.json");
  try {
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    const workspacePath = String(config.workspacePath || "").trim();
    if (workspacePath && fs.existsSync(workspacePath)) {
      return workspacePath;
    }
  } catch {
    // fall through
  }
  return fs.mkdtempSync(path.join(os.tmpdir(), "og-vscode-diagnose-"));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function forceCleanVSCodeProcesses() {
  try {
    execFileSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        "Get-Process -Name Code -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue",
      ],
      { stdio: "ignore", windowsHide: true },
    );
  } catch {
    // no running processes
  }
}

async function snapshotState(getVSCodeProcessState) {
  const state = await getVSCodeProcessState();
  return {
    at: new Date().toISOString(),
    ...state,
  };
}

async function main() {
  if (process.platform !== "win32") {
    console.error(JSON.stringify({ ok: false, error: "Windows-only diagnose script" }));
    process.exit(1);
  }

  delete require.cache[require.resolve("../src/sauron/vscode-window-focus")];
  delete require.cache[require.resolve("../src/sauron/vscode-launcher")];

  const {
    openWorkspaceInVSCode,
    focusWorkspaceInVSCode,
    resetLaunchDebounceForTests,
    markHandoffLaunchVerified,
    recordVerifiedLaunch,
    isWithinPostVerifyGrace,
  } = require("../src/sauron/vscode-launcher");
  const {
    getVSCodeProcessState,
    getVSCodeProcessCounts,
    resetScriptCacheForTests,
  } = require("../src/sauron/vscode-window-focus");

  resetScriptCacheForTests();
  resetLaunchDebounceForTests();

  const workspacePath = readWorkspaceFromConfig();
  const timeline = [];
  const terminateEvents = [];
  const zombieBeforeClean = await getVSCodeProcessCounts();
  timeline.push({ event: "zombie_before_clean", at: new Date().toISOString(), ...zombieBeforeClean });

  forceCleanVSCodeProcesses();
  await sleep(1500);
  timeline.push({ event: "after_clean", ...(await snapshotState(getVSCodeProcessState)) });

  const launchStartedAt = Date.now();
  const launchResult = await openWorkspaceInVSCode(workspacePath, {
    newWindow: true,
    force: true,
    verifyTimeoutMs: 25000,
  });
  timeline.push({ event: "launch_complete", at: new Date().toISOString(), launchResult });

  if (launchResult?.verified) {
    markHandoffLaunchVerified();
    recordVerifiedLaunch(launchResult);
  }

  await sleep(300);

  const postLaunchPollTimer = setInterval(async () => {
    timeline.push({ event: "poll_pre_focus", ...(await snapshotState(getVSCodeProcessState)) });
  }, 500);
  await sleep(500);
  clearInterval(postLaunchPollTimer);

  const focusResult = await focusWorkspaceInVSCode(workspacePath, { force: true });
  timeline.push({ event: "focus_complete", at: new Date().toISOString(), focusResult });

  terminateEvents.push({
    event: "post_verify_grace_active_after_focus",
    active: isWithinPostVerifyGrace(),
  });

  const escalationUsed = ["launch", "launch_after_recovery", "launch_disable_gpu", "launch_safe_mode", "focus_escalation", "focus_escalation_after_handoff"].some(
    (prefix) => String(focusResult?.action || "").startsWith(prefix)
      || String(focusResult?.recovery || "").includes("escalation"),
  ) || focusResult?.action === "wait_then_focus" || focusResult?.action === "focus_existing";

  const stabilityPollUntil = Date.now() + 15000;
  const stabilityTimer = setInterval(async () => {
    if (Date.now() > stabilityPollUntil) {
      return;
    }
    const counts = await getVSCodeProcessCounts();
    timeline.push({
      event: "poll_post_focus",
      ...(await snapshotState(getVSCodeProcessState)),
      processCounts: counts,
    });
  }, 500);

  await sleep(15000);
  clearInterval(stabilityTimer);

  timeline.push({
    event: "final",
    ...(await snapshotState(getVSCodeProcessState)),
    processCounts: await getVSCodeProcessCounts(),
  });

  const postFocusSnapshots = timeline.filter((entry) => entry.event === "poll_post_focus" || entry.event === "final");
  const stillOpenAfter15s = postFocusSnapshots.some(
    (entry) => (entry.running === true && entry.hasWindow === true)
      || (entry.processCounts && entry.processCounts.withWindow > 0),
  );
  const finalSnapshot = timeline.find((entry) => entry.event === "final") || {};
  const focusUsedSafePath = ["focus_existing", "wait_then_focus", "launch", "launch_after_recovery", "launch_disable_gpu", "launch_safe_mode"].includes(focusResult.action)
    || focusResult.action?.startsWith("launch_")
    || focusResult.skipped === true
    || focusResult.reason === "awaited_inflight_launch";
  const terminateAttempted = false;
  const report = {
    ok: Boolean(launchResult.verified) && stillOpenAfter15s,
    workspacePath,
    zombieBeforeClean,
    launchResult,
    focusResult,
    stillOpenAfter15s,
    focusUsedSafePath,
    escalationUsed,
    terminateAttempted,
    terminateEvents,
    recoveryUsed: launchResult.action === "launch_after_recovery"
      || focusResult.action === "launch_after_recovery"
      || focusResult.action?.startsWith("launch_"),
    note: "15s post-focus poll; terminate probe after focus should not kill verified window.",
    timeline,
  };

  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error?.message || String(error) }, null, 2));
  process.exit(1);
});
