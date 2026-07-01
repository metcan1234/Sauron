export function createGamedevBridgeStatusController() {
  async function refresh() {
    // Bridge status is configured and monitored from Settings, not the panel header.
  }

  return { refresh };
}
