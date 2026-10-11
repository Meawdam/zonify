// Optional local HTTPS preview for the production Next server. No public listener.
import { createServer } from "node:https";
import { request } from "node:http";
import { readFileSync } from "node:fs";
const port = Number(process.env.TLS_PORT ?? 3443);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("Invalid TLS_PORT");
if (!process.env.TLS_CERT || !process.env.TLS_KEY) throw new Error("Set TLS_CERT and TLS_KEY to your localhost certificate files");
const server = createServer({ cert: readFileSync(process.env.TLS_CERT), key: readFileSync(process.env.TLS_KEY) }, (req, res) => {
  if (req.headers.host !== `localhost:${port}`) { res.writeHead(400); res.end("Use the configured localhost HTTPS origin"); return; }
  const headers = { ...req.headers, "x-forwarded-proto": "https", "x-forwarded-host": req.headers.host };
  delete headers["x-forwarded-for"]; delete headers["forwarded"];
  const upstream = request({ hostname: "localhost", port: 3000, path: req.url, method: req.method, headers }, response => {
    res.writeHead(response.statusCode ?? 502, response.headers); response.pipe(res);
  });
  upstream.setTimeout(30_000, () => upstream.destroy());
  upstream.on("error", () => { if (!res.headersSent) res.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" }); res.end("Local frontend is unavailable"); });
  req.on("aborted", () => upstream.destroy()); req.pipe(upstream);
});
server.listen(port, "127.0.0.1", () => console.log(`Local HTTPS preview: https://localhost:${port}`));
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.close(() => process.exit(0)));
