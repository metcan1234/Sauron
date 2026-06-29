function readPositiveIntEnv(name, fallback) {
  const raw = Number.parseInt(process.env[name] || "", 10);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

const MICRO_GUIDE_MAX_TURNS = readPositiveIntEnv("SAURON_MICRO_GUIDE_MAX_TURNS", 15);
const MICRO_GUIDE_IDLE_MS = readPositiveIntEnv("SAURON_MICRO_GUIDE_IDLE_MS", 5 * 60 * 1000);

module.exports = {
  MICRO_GUIDE_MAX_TURNS,
  MICRO_GUIDE_IDLE_MS,
};
