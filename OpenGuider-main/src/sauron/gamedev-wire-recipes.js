const fs = require("fs");
const path = require("path");
const { normalizeGamedevEngine } = require("./gamedev-config");

const UNITY_RECIPES_DIR = path.join(__dirname, "unity-wire-recipes", "recipes");
const UNREAL_RECIPES_DIR = path.join(__dirname, "unreal-wire-recipes", "recipes");

function getRecipesDir(engine = "unity") {
  return normalizeGamedevEngine(engine) === "unreal" ? UNREAL_RECIPES_DIR : UNITY_RECIPES_DIR;
}

function listWireRecipeFiles(engine = null) {
  if (engine) {
    const dir = getRecipesDir(engine);
    if (!fs.existsSync(dir)) {
      return [];
    }
    return fs.readdirSync(dir).filter((name) => name.endsWith(".json"));
  }
  const unity = fs.existsSync(UNITY_RECIPES_DIR)
    ? fs.readdirSync(UNITY_RECIPES_DIR).filter((name) => name.endsWith(".json"))
    : [];
  const unreal = fs.existsSync(UNREAL_RECIPES_DIR)
    ? fs.readdirSync(UNREAL_RECIPES_DIR).filter((name) => name.endsWith(".json"))
    : [];
  return [...unity, ...unreal];
}

function loadWireRecipe(recipeId, engine = "unity") {
  const key = String(recipeId || "").trim();
  if (!key) {
    return null;
  }
  const dirs = engine ? [getRecipesDir(engine)] : [UNITY_RECIPES_DIR, UNREAL_RECIPES_DIR];
  for (const dir of dirs) {
    const recipePath = path.join(dir, `${key}.json`);
    if (fs.existsSync(recipePath)) {
      try {
        return JSON.parse(fs.readFileSync(recipePath, "utf8"));
      } catch {
        return null;
      }
    }
  }
  return null;
}

function resolveWireRecipePointer(genre, phase, engine = "unity") {
  const genreKey = String(genre || "").trim() || "empty";
  const phaseNum = Number(phase) || 1;
  const candidate = `${genreKey}-phase${phaseNum}`;
  const recipePath = path.join(getRecipesDir(engine), `${candidate}.json`);
  if (fs.existsSync(recipePath)) {
    return candidate;
  }
  if (normalizeGamedevEngine(engine) !== "unity") {
    const unityFallback = path.join(UNITY_RECIPES_DIR, `${candidate}.json`);
    if (fs.existsSync(unityFallback)) {
      return null;
    }
  }
  return null;
}

function getWireRecipeHandoffLine(recipeId, engine = "unity") {
  const recipe = loadWireRecipe(recipeId, engine);
  if (!recipe) {
    return "";
  }
  const folder = normalizeGamedevEngine(engine) === "unreal" ? "unreal-wire-recipes" : "unity-wire-recipes";
  return `Wire recipe file: src/sauron/${folder}/recipes/${recipeId}.json (${recipe.steps?.length || 0} steps)`;
}

module.exports = {
  UNITY_RECIPES_DIR,
  UNREAL_RECIPES_DIR,
  getRecipesDir,
  listWireRecipeFiles,
  loadWireRecipe,
  resolveWireRecipePointer,
  getWireRecipeHandoffLine,
};
