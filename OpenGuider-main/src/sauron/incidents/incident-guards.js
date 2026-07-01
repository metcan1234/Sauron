const {
  ALLOWED_SCRIPTED_ACTIONS,
  ALLOWED_STORE_KEYS,
  FORBIDDEN_ACTION_PATTERNS,
} = require("./constants");

function validateActionPayload(action = {}) {
  const name = String(action?.action || action?.type || "").trim();
  if (!ALLOWED_SCRIPTED_ACTIONS.has(name)) {
    return { ok: false, reason: `action_not_allowed:${name}` };
  }
  const serialized = JSON.stringify(action);
  for (const pattern of FORBIDDEN_ACTION_PATTERNS) {
    if (pattern.test(serialized)) {
      return { ok: false, reason: "forbidden_pattern" };
    }
  }
  return { ok: true, action: name };
}

function validateStoreMutation(key = "", value = undefined) {
  const normalizedKey = String(key || "").trim();
  if (!ALLOWED_STORE_KEYS.has(normalizedKey)) {
    return { ok: false, reason: `store_key_not_allowed:${normalizedKey}` };
  }
  if (value === undefined) {
    return { ok: false, reason: "store_value_missing" };
  }
  return { ok: true, key: normalizedKey, value };
}

function validateFixPlan(plan = {}) {
  const actions = Array.isArray(plan?.allowedActions) ? plan.allowedActions : [];
  const validated = [];
  for (const action of actions) {
    const result = validateActionPayload(action);
    if (!result.ok) {
      return result;
    }
    validated.push(action);
  }
  return { ok: true, allowedActions: validated };
}

module.exports = {
  validateActionPayload,
  validateStoreMutation,
  validateFixPlan,
};
