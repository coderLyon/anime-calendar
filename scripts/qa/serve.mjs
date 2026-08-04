/* 极简静态服务器：本地验证 dist 构建产物（避免 vite preview 的 esbuild 依赖） */
import { createServer } from "http";
import { readFile, stat } from "fs/promises";
import { extname, join, normalize, resolve } from "path";

const root = resolve(process.argv[2] || "dist");
const port = Number(process.argv[3] || 4173);
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".json": "application/json",
  ".ico": "image/x-icon",
};

createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", "http://localhost");
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === "/") pathname = "/index.html";
    if (pathname.startsWith("/anime-calendar")) pathname = pathname.slice("/anime-calendar".length) || "/index.html";
    let file = normalize(join(root, pathname));
    if (!file.startsWith(normalize(root))) {
      res.writeHead(403).end();
      return;
    }
    let st;
    try {
      st = await stat(file);
    } catch {
      file = join(root, "index.html");
      st = await stat(file);
    }
    if (st.isDirectory()) file = join(root, "index.html");
    const data = await readFile(file);
    res.writeHead(200, { "content-type": mime[extname(file)] ?? "application/octet-stream" });
    res.end(data);
  } catch (e) {
    res.writeHead(500);
    res.end(String(e));
  }
}).listen(port, () => console.log(`static server on http://localhost:${port}/anime-calendar/`));
