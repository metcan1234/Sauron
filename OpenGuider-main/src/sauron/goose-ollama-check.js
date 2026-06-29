const http = require("http");
const https = require("https");

function checkOllamaRunning(ollamaUrl = "http://localhost:11434") {
  const url = String(ollamaUrl || "http://localhost:11434").trim().replace(/\/$/, "");
  return new Promise((resolve) => {
    try {
      const parsed = new URL(`${url}/api/tags`);
      const client = parsed.protocol === "https:" ? https : http;
      const req = client.get(parsed, { timeout: 3000 }, (res) => {
        res.resume();
        resolve(res.statusCode >= 200 && res.statusCode < 300);
      });
      req.on("timeout", () => {
        req.destroy();
        resolve(false);
      });
      req.on("error", () => resolve(false));
    } catch {
      resolve(false);
    }
  });
}

module.exports = {
  checkOllamaRunning,
};
