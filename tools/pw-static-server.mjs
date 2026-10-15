/**
 * Static server for Playwright. Mounts the repo root at /ChristoDay/
 * so the clone directory name does not matter.
 * Node built-ins only.
 */
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MOUNT = "/ChristoDay";

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json",
};

function parsePort(raw) {
  const port = Number(String(raw).trim());
  if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
  return port;
}

function resolveListenPort() {
  const fromEnv = process.env.PW_PORT;
  const raw = fromEnv != null && String(fromEnv).trim() !== "" ? fromEnv : process.argv[2];
  if (raw == null || String(raw).trim() === "") {
    console.error("pw-static-server: port required via PW_PORT or argv[2]");
    process.exit(1);
  }
  const port = parsePort(raw);
  if (port == null) {
    console.error(
      `pw-static-server: invalid port ${JSON.stringify(String(raw).trim())} (expected an integer 1-65535)`,
    );
    process.exit(1);
  }
  return port;
}

function contentType(filePath) {
  return CONTENT_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}

function mapRequest(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return { status: 400, body: "Bad request\n" };
  }
  if (decoded.includes("\0")) return { status: 400, body: "Bad request\n" };
  if (decoded === "/") return { redirect: `${MOUNT}/` };
  if (decoded === MOUNT) return { redirect: `${MOUNT}/` };
  if (!decoded.startsWith(`${MOUNT}/`)) {
    return { status: 404, body: "Not found\n" };
  }
  // Reject ".." segments before resolving so encoded traversal cannot escape the repo.
  if (decoded.split("/").includes("..")) return { status: 403, body: "Forbidden\n" };

  let relative = decoded.slice(MOUNT.length).replace(/^\/+/, "");
  if (relative === "") relative = "index.html";

  const filePath = path.resolve(ROOT, relative);
  const rootPrefix = ROOT.endsWith(path.sep) ? ROOT : `${ROOT}${path.sep}`;
  if (filePath !== ROOT && !filePath.startsWith(rootPrefix)) {
    return { status: 403, body: "Forbidden\n" };
  }
  return { filePath };
}

function send(res, status, body, headers, method) {
  res.writeHead(status, headers);
  res.end(method === "HEAD" ? undefined : body);
}

const port = resolveListenPort();
const server = http.createServer(async (req, res) => {
  const method = req.method || "GET";
  try {
    if (method !== "GET" && method !== "HEAD") {
      send(
        res,
        405,
        "Method not allowed\n",
        { Allow: "GET, HEAD", "Content-Type": "text/plain; charset=utf-8" },
        method,
      );
      return;
    }

    let pathname;
    try {
      pathname = new URL(req.url || "/", "http://127.0.0.1").pathname;
    } catch {
      send(res, 400, "Bad request\n", { "Content-Type": "text/plain; charset=utf-8" }, method);
      return;
    }

    const mapped = mapRequest(pathname);
    if (mapped.redirect) {
      send(res, 302, "", { Location: mapped.redirect }, method);
      return;
    }
    if (mapped.status) {
      send(res, mapped.status, mapped.body, { "Content-Type": "text/plain; charset=utf-8" }, method);
      return;
    }

    const stat = await fs.stat(mapped.filePath);
    if (!stat.isFile()) {
      send(res, 404, "Not found\n", { "Content-Type": "text/plain; charset=utf-8" }, method);
      return;
    }
    const body = method === "HEAD" ? undefined : await fs.readFile(mapped.filePath);
    res.writeHead(200, {
      "Content-Type": contentType(mapped.filePath),
      "Content-Length": stat.size,
    });
    res.end(body);
  } catch (error) {
    if (res.headersSent) {
      res.destroy();
      return;
    }
    if (error && error.code === "ENOENT") {
      send(res, 404, "Not found\n", { "Content-Type": "text/plain; charset=utf-8" }, method);
      return;
    }
    send(res, 500, "Internal error\n", { "Content-Type": "text/plain; charset=utf-8" }, method);
  }
});

server.on("error", (error) => {
  console.error(`pw-static-server: ${error.message}`);
  process.exit(1);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`pw-static-server listening on http://127.0.0.1:${port}/ChristoDay/`);
});
