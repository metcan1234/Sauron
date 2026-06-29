const test = require("node:test");
const assert = require("node:assert/strict");

const {
  isLikelyGooseDesktopPath,
  namesMatchTurkish,
  runGooseVersion,
  resolveBinaryPathOnDisk,
} = require("../../../src/sauron/goose-binary-resolver");

test("isLikelyGooseDesktopPath detects Local Programs install", () => {
  assert.equal(
    isLikelyGooseDesktopPath("C:\\Users\\Can\\AppData\\Local\\Programs\\goose\\Goose.exe"),
    true,
  );
  assert.equal(
    isLikelyGooseDesktopPath("C:\\Users\\Can\\.local\\bin\\goose.exe"),
    false,
  );
});

test("namesMatchTurkish treats Turkish I/İ as distinct letters", () => {
  assert.equal(namesMatchTurkish("EVERYTHING", "EVERYTHING"), true);
  assert.equal(namesMatchTurkish("EVERYTHİNG", "EVERYTHİNG"), true);
  assert.equal(namesMatchTurkish("EVERYTHING", "EVERYTHİNG"), false);
});

test("resolveBinaryPathOnDisk returns null for missing path", () => {
  assert.equal(
    resolveBinaryPathOnDisk("Z:\\definitely-missing-sauron-goose\\goose.exe"),
    null,
  );
});

test("runGooseVersion returns null for missing binary", async () => {
  const version = await runGooseVersion("Z:\\missing\\goose.exe");
  assert.equal(version, null);
});
