/** Shared Sauron eye blink animation (PNG frame sequence). */

export const EYE_BLINK_FRAME_FILES = [
  "logo.png",
  "blink-75.png",
  "half-opened.png",
  "blink-25.png",
  "full-closed.png",
  "blink-25.png",
  "half-opened.png",
  "blink-75.png",
  "logo.png",
];

const CLOSE_FRAME_DELAYS_MS = [0, 110, 110, 110, 110];
const OPEN_FRAME_DELAYS_MS = [120, 65, 65, 65, 65];
const IDLE_MIN_MS = 3000;
const IDLE_JITTER_MS = 2000;

function prefersReducedMotion() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function resolveFrameSrc(basePath, file) {
  const base = String(basePath || "assets").replace(/\/$/, "");
  return `${base}/${file}`;
}

export function buildEyeBlinkFrames(basePath = "assets") {
  return EYE_BLINK_FRAME_FILES.map((file) => resolveFrameSrc(basePath, file));
}

export function preloadEyeBlinkFrames(basePath = "assets") {
  if (typeof Image === "undefined") {
    return Promise.resolve();
  }
  const frames = buildEyeBlinkFrames(basePath);
  return Promise.all(frames.map((src) => new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(src);
    img.onerror = () => resolve(src);
    img.src = src;
  })));
}

/**
 * @param {object} options
 * @param {string} [options.basePath]
 * @param {HTMLImageElement|HTMLImageElement[]} options.targets
 * @param {() => boolean} [options.isActive]
 */
export function createEyeBlinkController(options = {}) {
  const basePath = options.basePath || "assets";
  const targets = Array.isArray(options.targets)
    ? options.targets.filter(Boolean)
    : [options.targets].filter(Boolean);
  const isActive = typeof options.isActive === "function" ? options.isActive : () => true;
  const frames = buildEyeBlinkFrames(basePath);
  let timerId = null;
  let running = false;

  function setFrame(index) {
    const src = frames[index];
    if (!src) {
      return;
    }
    for (const el of targets) {
      if (el instanceof HTMLImageElement) {
        el.src = src;
      }
    }
  }

  function clearTimer() {
    if (timerId !== null) {
      window.clearTimeout(timerId);
      timerId = null;
    }
  }

  function scheduleIdleLoop() {
    clearTimer();
    if (!isActive()) {
      return;
    }
    const delay = IDLE_MIN_MS + Math.random() * IDLE_JITTER_MS;
    timerId = window.setTimeout(() => playBlinkSequence(0), delay);
  }

  function playBlinkSequence(index) {
    if (!isActive() || !targets.length) {
      scheduleIdleLoop();
      return;
    }
    if (index >= frames.length) {
      running = false;
      scheduleIdleLoop();
      return;
    }

    setFrame(index);
    running = true;

    let delay = 80;
    if (index > 0 && index <= 4) {
      delay = CLOSE_FRAME_DELAYS_MS[index] || 110;
    } else if (index >= 5) {
      delay = OPEN_FRAME_DELAYS_MS[index - 5] || 65;
    }

    timerId = window.setTimeout(() => playBlinkSequence(index + 1), delay);
  }

  function start() {
    if (prefersReducedMotion()) {
      setFrame(0);
      return;
    }
    void preloadEyeBlinkFrames(basePath);
    scheduleIdleLoop();
  }

  function stop() {
    clearTimer();
    running = false;
  }

  function blinkNow() {
    if (prefersReducedMotion()) {
      return Promise.resolve();
    }
    clearTimer();
    return new Promise((resolve) => {
      let index = 0;
      const step = () => {
        if (index >= frames.length) {
          running = false;
          scheduleIdleLoop();
          resolve();
          return;
        }
        setFrame(index);
        let delay = 80;
        if (index > 0 && index <= 4) {
          delay = CLOSE_FRAME_DELAYS_MS[index] || 110;
        } else if (index >= 5) {
          delay = OPEN_FRAME_DELAYS_MS[index - 5] || 65;
        }
        index += 1;
        timerId = window.setTimeout(step, delay);
      };
      running = true;
      step();
    });
  }

  return { start, stop, blinkNow, setFrame, frames };
}

export function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

/** Landing intro: dramatic open from closed. */
export async function playEyeIntroSequence(target, basePath = "assets") {
  if (!(target instanceof HTMLImageElement) || prefersReducedMotion()) {
    if (target instanceof HTMLImageElement) {
      target.src = resolveFrameSrc(basePath, "logo.png");
    }
    return;
  }

  const closed = resolveFrameSrc(basePath, "full-closed.png");
  const half = resolveFrameSrc(basePath, "half-opened.png");
  const open = resolveFrameSrc(basePath, "logo.png");

  target.src = closed;
  await wait(480);
  target.src = half;
  await wait(340);
  target.src = closed;
  await wait(280);
  target.src = half;
  await wait(300);
  target.src = open;
}
