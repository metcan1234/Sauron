async function safeHandleOrchestratorResult(handleFn, result, settings, sender, logContext = {}, logger = null) {
  try {
    return await handleFn(result, settings, sender);
  } catch (err) {
    if (logger && typeof logger.error === "function") {
      logger.error("orchestrator:post-process-failed", { ...logContext, error: err });
    }
    return result;
  }
}

module.exports = {
  safeHandleOrchestratorResult,
};
