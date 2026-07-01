const test = require("node:test");
const assert = require("node:assert/strict");
const net = require("net");
const { probeTcpPort, probeGamedevBridgePorts } = require("../../src/sauron/gamedev-bridge-probe");

function listenOnRandomPort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({ server, port });
    });
  });
}

test("probeTcpPort detects open port", async () => {
  const { server, port } = await listenOnRandomPort();
  try {
    const result = await probeTcpPort("127.0.0.1", port, 1200);
    assert.equal(result.ok, true);
    assert.equal(result.port, port);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("probeTcpPort reports closed port", async () => {
  const { server, port } = await listenOnRandomPort();
  await new Promise((resolve) => server.close(resolve));
  const result = await probeTcpPort("127.0.0.1", port, 400);
  assert.equal(result.ok, false);
});

test("probeGamedevBridgePorts returns structured summary", async () => {
  const result = await probeGamedevBridgePorts("127.0.0.1", "unity");
  assert.ok(Array.isArray(result.results));
  assert.equal(result.results.length, 1);
  assert.match(result.summary, /unity=/);
});
