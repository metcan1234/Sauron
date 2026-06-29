const test = require("node:test");
const assert = require("node:assert/strict");

const { detectGooseComplexity } = require("../../../src/sauron/goose-complexity");

test("detectGooseComplexity routes simple file ops to economy", () => {
  assert.equal(detectGooseComplexity("bu dosyayı aç ve göster"), "economy");
  assert.equal(detectGooseComplexity("list all files in src"), "economy");
});

test("detectGooseComplexity routes architecture tasks to premium", () => {
  assert.equal(detectGooseComplexity("tüm projeyi refactor et ve mimariyi düzenle"), "premium");
  assert.equal(detectGooseComplexity("migrate database schema to production"), "premium");
});

test("detectGooseComplexity defaults to balanced for medium tasks", () => {
  assert.equal(detectGooseComplexity("add unit tests for the router module"), "balanced");
  assert.equal(detectGooseComplexity(""), "balanced");
});
