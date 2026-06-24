const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

test("panel html contains core controls and error/onboarding blocks", () => {
  const html = fs.readFileSync(
    path.join(__dirname, "../../renderer/index.html"),
    "utf8",
  );

  assert.match(html, /id="text-input"/);
  assert.match(html, /id="btn-plan-prev"/);
  assert.match(html, /id="btn-plan-skip"/);
  assert.match(html, /id="btn-plan-regenerate"/);
  assert.match(html, /id="error-banner"/);
  assert.match(html, /id="onboarding-overlay"/);
  assert.match(html, /id="btn-gamedev"/);
  assert.match(html, /id="empty-cta-gamedev"/);
  assert.match(html, /id="gamedev-studio-bar"/);
  assert.match(html, /id="gamedev-template-select"/);
  assert.match(html, /id="gamedev-setup-overlay"/);
  assert.match(html, /header-center-title/);
});
