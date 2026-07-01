import {
  getPersonaCodeCompleteMessage,
  getPersonaCodeErrorMessage,
  getPersonaCodeStartMessage,
  pickIntroGreeting,
} from "./persona-messages.js";

export function createIntroHandler({ api, messaging, state, ui, log }) {
  let introInFlight = false;

  async function appendIntroMessage(content) {
    const result = await api.invoke("append-assistant-message", { content });
    if (result?.session) {
      state.setSessionSnapshot(result.session);
      ui.renderConversation(result.session.messages || []);
      ui.scrollToBottom?.();
    }
  }

  async function maybeShowIntro(settings, messages = []) {
    const config = settings || state.getSettings?.() || {};
    if (config.introOnNewChat === false) {
      return;
    }
    if ((messages || []).length > 0) {
      return;
    }
    if (introInFlight || state.isStreaming?.()) {
      return;
    }

    introInFlight = true;
    try {
      const greeting = await pickIntroGreeting(api, config);
      if (greeting) {
        await appendIntroMessage(greeting);
        return;
      }

      if (typeof messaging?.sendIntroRequest === "function") {
        await messaging.sendIntroRequest();
      }
    } catch (error) {
      log?.("intro:maybeShowIntro error", error);
    } finally {
      introInFlight = false;
    }
  }

  return { maybeShowIntro };
}

export {
  getPersonaCodeCompleteMessage,
  getPersonaCodeErrorMessage,
  getPersonaCodeStartMessage,
  pickIntroGreeting,
};
