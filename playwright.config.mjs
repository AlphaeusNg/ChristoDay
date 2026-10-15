import { defineConfig } from "@playwright/test";
import net from "node:net";

function parsePort(raw) {
  const port = Number(String(raw).trim());
  if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
  return port;
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = address && typeof address === "object" ? address.port : 0;
      server.close((error) => {
        if (error) reject(error);
        else if (!port) reject(new Error("Could not allocate a free port on 127.0.0.1"));
        else resolve(port);
      });
    });
  });
}

async function resolvePort() {
  const raw = process.env.PW_PORT;
  if (raw != null && String(raw).trim() !== "") {
    const port = parsePort(raw);
    if (port == null) {
      throw new Error(
        `PW_PORT must be an integer from 1 to 65535 (got ${JSON.stringify(String(raw).trim())})`,
      );
    }
    return port;
  }
  return freePort();
}

export default await (async () => {
  const port = await resolvePort();
  process.env.PW_PORT = String(port);
  const baseURL = `http://127.0.0.1:${port}/ChristoDay/`;
  return defineConfig({
    testDir: "./tests/browser",
    fullyParallel: false,
    workers: 1,
    timeout: 20_000,
    expect: {
      timeout: 8_000,
    },
    reporter: [["line"]],
    use: {
      baseURL,
      browserName: "chromium",
      trace: "retain-on-failure",
    },
    projects: [
      {
        name: "reading",
        testMatch: /reading\.spec\.mjs/,
        use: { serviceWorkers: "block" },
      },
      {
        name: "offline",
        testMatch: /offline\.spec\.mjs/,
        use: { serviceWorkers: "allow" },
      },
    ],
    webServer: {
      command: `node tools/pw-static-server.mjs ${port}`,
      url: baseURL,
      reuseExistingServer: Boolean(!process.env.CI && process.env.PW_REUSE_SERVER === "1"),
      timeout: 15_000,
    },
  });
})();
