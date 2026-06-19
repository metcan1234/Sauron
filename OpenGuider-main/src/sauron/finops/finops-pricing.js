const { createLogger } = require("../../logger");
const catalog = require("./finops-model-catalog.json");

const logger = createLogger("finops-pricing");

function normalizeKey(value) {
  return String(value || "").trim().toLowerCase();
}

function modelPrefixMatches(modelId, catalogModel) {
  const id = normalizeKey(modelId);
  const entry = normalizeKey(catalogModel);
  if (!id || !entry) return false;
  return id === entry || id.startsWith(`${entry}-`) || id.startsWith(`${entry}:`);
}

function findCatalogEntry(provider, model) {
  const providerKey = normalizeKey(provider);
  const modelKey = normalizeKey(model);

  let best = null;
  for (const entry of catalog) {
    if (normalizeKey(entry.provider) !== providerKey) continue;
    const entryModel = normalizeKey(entry.model);
    if (modelKey === entryModel || modelPrefixMatches(model, entry.model)) {
      if (!best || entryModel.length > normalizeKey(best.model).length) {
        best = entry;
      }
    }
  }
  return best;
}

function getProviderAveragePrice(provider) {
  const providerKey = normalizeKey(provider);
  const prices = catalog
    .filter((entry) => normalizeKey(entry.provider) === providerKey)
    .map((entry) => Number(entry.pricePerMillionTokensTl))
    .filter((value) => Number.isFinite(value));

  if (!prices.length) return null;
  const sum = prices.reduce((acc, value) => acc + value, 0);
  return sum / prices.length;
}

function resolvePricePerMillionTokensTl(provider, model, settings = {}, onDiscovered) {
  const providerKey = normalizeKey(provider);
  const modelKey = normalizeKey(model);

  const catalogEntry = findCatalogEntry(provider, model);
  if (catalogEntry) {
    return {
      pricePerMillionTokensTl: Number(catalogEntry.pricePerMillionTokensTl) || 0,
      source: "catalog",
    };
  }

  const modelOverrides = settings.finopsModelPriceOverrides || {};
  for (const [overrideModel, price] of Object.entries(modelOverrides)) {
    if (modelPrefixMatches(model, overrideModel)) {
      const numeric = Number(price);
      if (Number.isFinite(numeric)) {
        return { pricePerMillionTokensTl: numeric, source: "model-override" };
      }
    }
  }

  const providerOverrides = settings.finopsProviderPriceOverrides || {};
  const providerOverride = providerOverrides[provider] ?? providerOverrides[providerKey];
  if (providerOverride != null) {
    const numeric = Number(providerOverride);
    if (Number.isFinite(numeric)) {
      return { pricePerMillionTokensTl: numeric, source: "provider-override" };
    }
  }

  const discovered = settings.finopsDiscoveredModels || {};
  const discoveredKey = `${providerKey}:${modelKey}`;
  if (discovered[discoveredKey] != null) {
    const numeric = Number(discovered[discoveredKey].pricePerMillionTokensTl ?? discovered[discoveredKey]);
    if (Number.isFinite(numeric)) {
      return { pricePerMillionTokensTl: numeric, source: "discovered" };
    }
  }

  const providerAverage = getProviderAveragePrice(provider);
  if (providerAverage != null) {
    if (typeof onDiscovered === "function") {
      onDiscovered({
        provider: providerKey,
        model: modelKey,
        pricePerMillionTokensTl: providerAverage,
      });
    }
    logger.warn("finops-pricing:fallback-provider-average", {
      provider: providerKey,
      model: modelKey,
      pricePerMillionTokensTl: providerAverage,
    });
    return { pricePerMillionTokensTl: providerAverage, source: "provider-average" };
  }

  const defaultPrice = Number(settings.finopsDefaultPricePerMillionTl);
  const fallbackPrice = Number.isFinite(defaultPrice) ? defaultPrice : 50;
  if (typeof onDiscovered === "function") {
    onDiscovered({
      provider: providerKey,
      model: modelKey,
      pricePerMillionTokensTl: fallbackPrice,
    });
  }
  logger.warn("finops-pricing:fallback-default", {
    provider: providerKey,
    model: modelKey,
    pricePerMillionTokensTl: fallbackPrice,
  });
  return { pricePerMillionTokensTl: fallbackPrice, source: "default" };
}

function calculateCostTl({
  provider,
  model,
  promptTokens = 0,
  completionTokens = 0,
  settings = {},
  onDiscovered,
}) {
  const totalTokens = Math.max(0, Number(promptTokens) || 0) + Math.max(0, Number(completionTokens) || 0);
  const { pricePerMillionTokensTl, source } = resolvePricePerMillionTokensTl(
    provider,
    model,
    settings,
    onDiscovered,
  );
  const costTl = (totalTokens / 1_000_000) * pricePerMillionTokensTl;
  return {
    costTl: Number.isFinite(costTl) ? costTl : 0,
    pricePerMillionTokensTl,
    source,
    totalTokens,
  };
}

function convertUsdToTl(costUsd, settings = {}) {
  const rate = Number(settings.finopsUsdToTl);
  const usd = Number(costUsd);
  if (!Number.isFinite(usd) || !Number.isFinite(rate) || rate <= 0) {
    return 0;
  }
  return usd * rate;
}

module.exports = {
  findCatalogEntry,
  resolvePricePerMillionTokensTl,
  calculateCostTl,
  convertUsdToTl,
  getProviderAveragePrice,
};
