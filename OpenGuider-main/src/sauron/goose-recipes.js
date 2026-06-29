const GOOSE_RECIPES = {
  bugfix: {
    id: "bugfix",
    label: "Bugfix",
    promptPrefix: "Fix the reported bug with minimal diff. Run relevant tests after changes.",
    maxTurns: 12,
  },
  refactor: {
    id: "refactor",
    label: "Refactor",
    promptPrefix: "Refactor for clarity without behavior change. Keep commits small and explain tradeoffs briefly.",
    maxTurns: 16,
  },
  test: {
    id: "test",
    label: "Test run",
    promptPrefix: "Run the project's test suite, summarize failures, and propose fixes only if asked.",
    maxTurns: 8,
  },
  feature: {
    id: "feature",
    label: "Feature",
    promptPrefix: "Implement the requested feature with a short plan first, then minimal diffs. Avoid unrelated refactors.",
    maxTurns: 18,
  },
  debug: {
    id: "debug",
    label: "Debug",
    promptPrefix: "Diagnose the issue with logs/repro steps, then apply the smallest fix. Summarize root cause briefly.",
    maxTurns: 14,
  },
  "gamedev-bridge": {
    id: "gamedev-bridge",
    label: "GameDev bridge",
    promptPrefix: "Use MCP/game-dev tools first. Prefer scene cache pointers over full file dumps. Keep token usage low.",
    maxTurns: 16,
  },
};

function resolveGooseRecipe(recipeId) {
  const key = String(recipeId || "").trim().toLowerCase();
  return GOOSE_RECIPES[key] || null;
}

function applyRecipeToTask(taskText, recipeId) {
  const recipe = resolveGooseRecipe(recipeId);
  const base = String(taskText || "").trim();
  if (!recipe) {
    return { text: base, recipe: null };
  }
  return {
    text: `${recipe.promptPrefix}\n\n${base}`.trim(),
    recipe,
  };
}

function listGooseRecipes() {
  return Object.values(GOOSE_RECIPES);
}

module.exports = {
  GOOSE_RECIPES,
  resolveGooseRecipe,
  applyRecipeToTask,
  listGooseRecipes,
};
