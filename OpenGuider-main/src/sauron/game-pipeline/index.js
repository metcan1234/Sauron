const { listGamePipelines, getGamePipeline, resolvePipelineForTemplate } = require("./game-pipeline-registry");
const { planGamePipeline } = require("./game-pipeline-planner");
const {
  startGamePipeline,
  advanceGamePipeline,
  advanceGamePipelineAfterComplete,
  getCurrentPhaseGoal,
  getGamePipelineStatus,
} = require("./game-pipeline-runner");

module.exports = {
  listGamePipelines,
  getGamePipeline,
  resolvePipelineForTemplate,
  planGamePipeline,
  startGamePipeline,
  advanceGamePipeline,
  advanceGamePipelineAfterComplete,
  getCurrentPhaseGoal,
  getGamePipelineStatus,
};
