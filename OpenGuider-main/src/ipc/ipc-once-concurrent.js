const inFlightByChannel = new Map();

function wrapOnceConcurrent(channel, handler) {
  return async (event, ...args) => {
    if (inFlightByChannel.has(channel)) {
      return { ok: false, error: "already-in-progress", skipped: true };
    }

    const promise = Promise.resolve()
      .then(() => handler(event, ...args))
      .finally(() => {
        if (inFlightByChannel.get(channel) === promise) {
          inFlightByChannel.delete(channel);
        }
      });

    inFlightByChannel.set(channel, promise);
    return promise;
  };
}

function registerOnceConcurrent(ipcMain, channel, handler) {
  ipcMain.handle(channel, wrapOnceConcurrent(channel, handler));
}

function resetOnceConcurrentForTests() {
  inFlightByChannel.clear();
}

function isChannelInFlight(channel) {
  return inFlightByChannel.has(channel);
}

module.exports = {
  wrapOnceConcurrent,
  registerOnceConcurrent,
  resetOnceConcurrentForTests,
  isChannelInFlight,
};
