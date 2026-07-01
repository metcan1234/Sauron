const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);

async function readPackageScripts(workspacePath) {
  try {
    const pkg = JSON.parse(require("fs").readFileSync(require("path").join(workspacePath, "package.json"), "utf8"));
    return pkg.scripts || {};
  } catch {
    return {};
  }
}

async function runScript(workspacePath, scriptName) {
  const scripts = await readPackageScripts(workspacePath);
  if (!scripts[scriptName]) {
    return { ok: true, skipped: true, reason: `no ${scriptName} script` };
  }
  try {
    const npm = process.platform === "win32" ? "npm.cmd" : "npm";
    const { stdout, stderr } = await execFileAsync(npm, ["run", scriptName], {
      cwd: workspacePath,
      timeout: 120000,
      maxBuffer: 1024 * 1024,
    });
    const output = `${stdout || ""}\n${stderr || ""}`.trim();
    const failed = /FAIL|Error:|error Command failed/i.test(output);
    return { ok: !failed, output, scriptName };
  } catch (error) {
    return {
      ok: false,
      output: String(error.stdout || error.stderr || error.message || ""),
      scriptName,
      error: error.message || "script failed",
    };
  }
}

async function runRepairVerification(workspacePath) {
  const testResult = await runScript(workspacePath, "test");
  if (!testResult.skipped && !testResult.ok) {
    return { ok: false, phase: "test", ...testResult };
  }
  const lintResult = await runScript(workspacePath, "lint");
  if (!lintResult.skipped && !lintResult.ok) {
    return { ok: false, phase: "lint", ...lintResult };
  }
  return { ok: true, testResult, lintResult };
}

module.exports = {
  runScript,
  runRepairVerification,
  readPackageScripts,
};
