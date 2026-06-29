const fs = require("fs");
const path = require("path");

const RECIPES_DIR = path.join(__dirname, "recipes");

function listWireRecipeFiles() {
  if (!fs.existsSync(RECIPES_DIR)) {
    return [];
  }
  return fs.readdirSync(RECIPES_DIR).filter((name) => name.endsWith(".json"));
}

function loadWireRecipe(recipeId) {
  const key = String(recipeId || "").trim();
  if (!key) {
    return null;
  }
  const recipePath = path.join(RECIPES_DIR, `${key}.json`);
  if (!fs.existsSync(recipePath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(recipePath, "utf8"));
  } catch {
    return null;
  }
}

function resolveWireRecipePointer(genre, phase) {
  const genreKey = String(genre || "").trim() || "empty";
  const phaseNum = Number(phase) || 1;
  const candidate = `${genreKey}-phase${phaseNum}`;
  const recipePath = path.join(RECIPES_DIR, `${candidate}.json`);
  if (fs.existsSync(recipePath)) {
    return candidate;
  }
  return null;
}

function getWireRecipeHandoffLine(recipeId) {
  const recipe = loadWireRecipe(recipeId);
  if (!recipe) {
    return "";
  }
  return `Wire recipe file: src/sauron/unity-wire-recipes/recipes/${recipeId}.json (${recipe.steps?.length || 0} steps)`;
}

module.exports = {
  RECIPES_DIR,
  listWireRecipeFiles,
  loadWireRecipe,
  resolveWireRecipePointer,
  getWireRecipeHandoffLine,
};
