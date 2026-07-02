export function isNoHandlerRegisteredError(error) {
  const message = String(error?.message || error || "");
  return /No handler registered/i.test(message);
}

export async function safeInvoke(api, channel, ...args) {
  const maxRetries = 5;
  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    try {
      return await api.invoke(channel, ...args);
    } catch (error) {
      if (!isNoHandlerRegisteredError(error) || attempt === maxRetries - 1) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 50 * (attempt + 1)));
    }
  }
  return undefined;
}
