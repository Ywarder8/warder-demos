#!/usr/bin/env node
/*
 * Serves dist/_worker.js locally the way Cloudflare does (same worker, gzip/brotli), so tests
 * can run against exactly what gets deployed.
 *
 *   node scripts/build-worker.js && node scripts/serve.mjs [port]
 */
import http from "node:http";
import zlib from "node:zlib";
import path from "node:path";
import { pathToFileURL } from "node:url";

const port = Number(process.argv[2] || 8787);
const worker = (await import(pathToFileURL(path.resolve(import.meta.dirname, "..", "dist", "_worker.js")).href)).default;

http.createServer(async (req, res) => {
  const response = await worker.fetch(new Request(`http://localhost:${port}${req.url}`, { method: req.method }));
  const headers = Object.fromEntries(response.headers);
  let body = Buffer.from(await response.arrayBuffer());
  const accept = req.headers["accept-encoding"] || "";
  if (body.length > 1024 && /text\//.test(headers["content-type"] || "")) {
    if (/\bbr\b/.test(accept)) { body = zlib.brotliCompressSync(body); headers["content-encoding"] = "br"; }
    else if (/gzip/.test(accept)) { body = zlib.gzipSync(body); headers["content-encoding"] = "gzip"; }
  }
  headers["content-length"] = body.length;
  res.writeHead(response.status, headers);
  res.end(req.method === "HEAD" ? undefined : body);
}).listen(port, () => console.log(`serving dist/_worker.js on http://localhost:${port}`));
