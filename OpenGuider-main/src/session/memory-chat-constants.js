function readPositiveIntEnv(name, fallback) {
  const raw = Number.parseInt(process.env[name] || "", 10);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

const MEMORY_COMPRESS_THRESHOLD = readPositiveIntEnv("SAURON_MEMORY_COMPRESS_THRESHOLD", 40);
const MEMORY_COMPRESS_BATCH = readPositiveIntEnv("SAURON_MEMORY_COMPRESS_BATCH", 20);
const MEMORY_CONTEXT_RECENT = readPositiveIntEnv("SAURON_MEMORY_CONTEXT_RECENT", 20);

const MEMORY_SUMMARY_ROLE = "memory-summary";

module.exports = {
  MEMORY_COMPRESS_THRESHOLD,
  MEMORY_COMPRESS_BATCH,
  MEMORY_CONTEXT_RECENT,
  MEMORY_SUMMARY_ROLE,
};
