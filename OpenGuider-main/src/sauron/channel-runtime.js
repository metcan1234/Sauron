/**
 * @file channel-runtime.js
 *
 * Shared process lifecycle manager for all Sauron channels.
 *
 * Every channel that launches an external process (‍⌘ Çalışma Kısmı, ‍🪿 Goose,
 * ‍🎮 Game Dev, Browser Agent) reports its process(es) here so that:
 *   1. UI status queries use real PID health checks instead of file/flag state.
 *   2. Failed launches clean up any spawned processes (no orphan leaks).
 *   3. Audit events are written to .sauron/usage/channel-runtime.jsonl.
 *
 * Usage:
 *   const runtime = require('./channel-runtime');
 *   runtime.registerProcess('goose', pid, { sessionId, workspacePath });
 *   const alive = runtime.isAlive('goose');
 *   await runtime.killChannel('goose');
 *   runtime.unregisterProcess('goose');
 */

const fs = require('fs');
const path = require('path');
const { spawn, execFile } = require('child_process');

// ── In-memory process registry ──────────────────────────────────────────────

/** @type {Map<string, { pid: number, startedAt: number, meta: object }>} */
const _processes = new Map();

// ── Audit log ───────────────────────────────────────────────────────────────

function getAuditLogPath(workspacePath) {
  const base = workspacePath
    ? path.join(workspacePath, '.sauron', 'usage')
    : path.join(process.env.APPDATA || process.cwd(), '.sauron', 'usage');
  return path.join(base, 'channel-runtime.jsonl');
}

function ensureAuditDir(auditPath) {
  const dir = path.dirname(auditPath);
  try { fs.mkdirSync(dir, { recursive: true }); } catch { /* ignore */ }
}

function writeAuditLog({ channelId, sessionId, workspacePath, oldState, newState, reason, pid, metadata }) {
  try {
    const auditPath = getAuditLogPath(workspacePath);
    ensureAuditDir(auditPath);
    const entry = JSON.stringify({
      t: new Date().toISOString(),
      channel: channelId,
      sessionId: sessionId || null,
      workspacePath: workspacePath || null,
      from: oldState || null,
      to: newState,
      reason: reason || null,
      pid: pid || null,
      meta: metadata || null,
    });
    fs.appendFileSync(auditPath, entry + '\n', 'utf8');
  } catch { /* silent */ }
}

// ── Core API ────────────────────────────────────────────────────────────────

/**
 * Register a running process under a channel id.
 * @param {string} channelId — one of 'workspace', 'goose', 'gamedev', 'browser'
 * @param {number} pid — OS process id
 * @param {object} [meta] — optional { sessionId, workspacePath, label, dependencyPath }
 */
function registerProcess(channelId, pid, meta = {}) {
  if (!channelId || typeof pid !== 'number' || pid <= 0) {
    writeAuditLog({ channelId, newState: 'register_skipped', reason: 'invalid_args', metadata: meta });
    return;
  }
  const old = _processes.get(channelId);
  _processes.set(channelId, { pid, startedAt: Date.now(), meta });
  writeAuditLog({
    channelId,
    sessionId: meta.sessionId,
    workspacePath: meta.workspacePath,
    oldState: old ? 'running' : null,
    newState: 'registered',
    reason: 'registerProcess',
    pid,
    metadata: { label: meta.label, dependencyPath: meta.dependencyPath },
  });
}

/**
 * Remove a channel's process from the registry (after confirming it's stopped).
 * Does NOT kill the process — use killChannel() for that.
 */
function unregisterProcess(channelId) {
  const entry = _processes.get(channelId);
  if (!entry) return;
  _processes.delete(channelId);
  writeAuditLog({
    channelId,
    sessionId: entry.meta.sessionId,
    workspacePath: entry.meta.workspacePath,
    oldState: 'registered',
    newState: 'unregistered',
    reason: 'unregisterProcess',
    pid: entry.pid,
  });
}

/**
 * Check whether a process is alive at the OS level.
 * Uses process.kill(pid, 0) which is a signal 0 probe — never kills.
 * @param {string} channelId
 * @returns {boolean} true if the PID exists and is accessible
 */
function isAlive(channelId) {
  const entry = _processes.get(channelId);
  if (!entry || typeof entry.pid !== 'number' || entry.pid <= 0) {
    return false;
  }
  try {
    // signal 0 = test liveness, no kill
    return process.kill(entry.pid, 0);
  } catch (err) {
    // ESRCH = no such process, EPERM = exists but permission denied (treat as alive)
    return err.code === 'EPERM';
  }
}

/**
 * Get the full runtime state for a channel.
 * @returns {{ registered: boolean, alive: boolean, pid: number|null, startedAt: number|null, meta: object }|null}
 */
function getState(channelId) {
  const entry = _processes.get(channelId);
  if (!entry) {
    return { registered: false, alive: false, pid: null, startedAt: null, meta: {} };
  }
  return {
    registered: true,
    alive: isAlive(channelId),
    pid: entry.pid,
    startedAt: entry.startedAt,
    meta: { ...entry.meta },
  };
}

/**
 * Get state for all channels.
 * @returns {Record<string, { registered: boolean, alive: boolean, pid: number|null, startedAt: number|null, meta: object }>}
 */
function getAllStates() {
  const channels = ['workspace', 'goose', 'gamedev', 'browser'];
  const result = {};
  for (const ch of channels) {
    result[ch] = getState(ch);
  }
  return result;
}

// ── Platform-specific kill ──────────────────────────────────────────────────

/**
 * Kill a channel's process and all its descendants.
 *   Windows: taskkill /PID <pid> /T /F
 *   macOS/Linux: process group kill (SIGTERM → SIGKILL after grace)
 *
 * @param {string} channelId
 * @param {object} [options]
 * @param {number} [options.graceMs] — time to wait before SIGKILL fallback (default 3000)
 * @returns {Promise<{ ok: boolean, reason: string }>}
 */
async function killChannel(channelId, options = {}) {
  const entry = _processes.get(channelId);
  if (!entry) {
    return { ok: false, reason: 'not_registered' };
  }

  const pid = entry.pid;
  if (typeof pid !== 'number' || pid <= 0) {
    return { ok: false, reason: 'invalid_pid' };
  }

  const graceMs = typeof options.graceMs === 'number' ? options.graceMs : 3000;
  let killResult;

  if (process.platform === 'win32') {
    killResult = await _killWindowsTree(pid, graceMs);
  } else {
    killResult = await _killUnixProcessGroup(pid, graceMs);
  }

  writeAuditLog({
    channelId,
    sessionId: entry.meta.sessionId,
    workspacePath: entry.meta.workspacePath,
    oldState: 'registered',
    newState: killResult.ok ? 'killed' : 'kill_failed',
    reason: killResult.ok ? 'killChannel' : `killChannel:${killResult.reason}`,
    pid,
    metadata: { signal: killResult.signal },
  });

  if (killResult.ok) {
    _processes.delete(channelId);
  }
  return killResult;
}

/** Kill a process and its tree on Windows via taskkill */
function _killWindowsTree(pid, graceMs) {
  return new Promise((resolve) => {
    execFile('taskkill', ['/PID', String(pid), '/T', '/F'], { timeout: graceMs + 2000 }, (err, stdout) => {
      if (!err || (err && String(err.message).includes('not found'))) {
        resolve({ ok: true, signal: 'taskkill /T /F', reason: 'ok' });
      } else {
        // Fallback: try taskkill without /T
        execFile('taskkill', ['/PID', String(pid), '/F'], { timeout: 5000 }, (err2) => {
          resolve({
            ok: !err2,
            signal: 'taskkill /F',
            reason: err2 ? `kill_failed: ${err2.message}` : 'ok',
          });
        });
      }
    });
  });
}

/** Kill a process group on Unix (macOS/Linux) */
function _killUnixProcessGroup(pid, graceMs) {
  return new Promise((resolve) => {
    try {
      process.kill(-pid, 'SIGTERM');
    } catch (err) {
      if (err.code === 'ESRCH') {
        return resolve({ ok: true, signal: 'SIGTERM-ESRCH', reason: 'already_dead' });
      }
      // Single process fallback
      try { process.kill(pid, 'SIGTERM'); } catch { /* ignore */ }
    }

    const timer = setTimeout(() => {
      try {
        process.kill(-pid, 'SIGKILL');
      } catch { try { process.kill(pid, 'SIGKILL'); } catch { /* ignore */ } }
      resolve({ ok: true, signal: 'SIGKILL', reason: 'grace_expired' });
    }, graceMs);

    // Check if process exited during grace
    const check = setInterval(() => {
      try {
        process.kill(pid, 0);
      } catch {
        clearInterval(check);
        clearTimeout(timer);
        resolve({ ok: true, signal: 'SIGTERM', reason: 'exit_during_grace' });
      }
    }, 200);
  });
}

// ── Stale session sweep ─────────────────────────────────────────────────────

/**
 * Scan a workspace's `.sauron/` directory for handoff-*.json, *-session.json,
 * and *.lock files with embedded PIDs. If the PID is still alive, register it;
 * if dead or absent, remove the stale file.
 *
 * @param {string} workspacePath
 * @returns {Promise<{ cleaned: number, recovered: number }>}
 */
async function sweepStaleSessions(workspacePath) {
  if (!workspacePath || !fs.existsSync(workspacePath)) {
    return { cleaned: 0, recovered: 0 };
  }

  const sauronDir = path.join(workspacePath, '.sauron');
  if (!fs.existsSync(sauronDir)) {
    return { cleaned: 0, recovered: 0 };
  }

  let cleaned = 0;
  let recovered = 0;

  let entries;
  try {
    entries = fs.readdirSync(sauronDir, { withFileTypes: true });
  } catch {
    return { cleaned: 0, recovered: 0 };
  }

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const name = entry.name;

    // Match handoff-*.json, *-session.json, *.lock
    const isSessionFile = /^handoff-.+\.json$/.test(name)
      || /-session\.json$/.test(name)
      || /\.lock$/.test(name);

    if (!isSessionFile) continue;

    const fullPath = path.join(sauronDir, name);
    let pid = null;

    try {
      const raw = fs.readFileSync(fullPath, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.pid === 'number' && parsed.pid > 0) {
        pid = parsed.pid;
      }
    } catch {
      // Not JSON or no PID field — skip or clean up stale lock files
      if (name.endsWith('.lock')) {
        try { fs.unlinkSync(fullPath); cleaned++; } catch { /* ignore */ }
      }
      continue;
    }

    if (pid) {
      try {
        process.kill(pid, 0);
        // Process is alive — try to recover to runtime registry
        const channelId = _inferChannelFromFileName(name);
        if (channelId && !_processes.has(channelId)) {
          registerProcess(channelId, pid, {
            sessionId: parsed.sessionId || null,
            workspacePath,
            label: name,
            dependencyPath: fullPath,
          });
          recovered++;
        }
      } catch {
        // Process is dead — clean up stale file
        try { fs.unlinkSync(fullPath); cleaned++; } catch { /* ignore */ }
      }
    }
  }

  if (cleaned > 0 || recovered > 0) {
    writeAuditLog({
      channelId: 'sweep',
      newState: 'sweep_complete',
      reason: `cleaned=${cleaned} recovered=${recovered}`,
      metadata: { workspacePath },
    });
  }

  return { cleaned, recovered };
}

function _inferChannelFromFileName(name) {
  if (/^handoff-.*\.json$/.test(name)) return 'workspace';
  if (/goose/.test(name)) return 'goose';
  if (/gamedev/.test(name)) return 'gamedev';
  if (/browser/.test(name)) return 'browser';
  return null;
}

/**
 * Rotate the audit log if it exceeds MAX_AUDIT_BYTES (5 MB).
 * Renames current .jsonl → .jsonl.bak and starts a fresh file.
 * @param {string} workspacePath
 */
function rotateAuditLog(workspacePath) {
  const MAX_AUDIT_BYTES = 5 * 1024 * 1024;
  const auditPath = getAuditLogPath(workspacePath);
  try {
    const stat = fs.statSync(auditPath);
    if (stat.size <= MAX_AUDIT_BYTES) return;
    const bakPath = auditPath + '.bak';
    // Remove old .bak if exists
    try { fs.unlinkSync(bakPath); } catch { /* ignore */ }
    fs.renameSync(auditPath, bakPath);
    // Start fresh file
    ensureAuditDir(auditPath);
  } catch {
    // file doesn't exist yet — fine
  }
}

// ── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  registerProcess,
  unregisterProcess,
  isAlive,
  getState,
  getAllStates,
  killChannel,
  sweepStaleSessions,
  rotateAuditLog,
  // Exposed for test introspection
  _resetForTest() { _processes.clear(); },
};
