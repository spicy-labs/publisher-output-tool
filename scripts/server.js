import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { join, extname } from "path";

const PORT = process.env.PORT || 3000;
const STATIC_DIR = join(import.meta.dirname, "..", "dist", "frontend");

const MIME_TYPES = {
  ".html": "text/html",
  ".js":   "application/javascript",
  ".css":  "text/css",
  ".json": "application/json",
  ".map":  "application/json",
};

const server = createServer((req, res) => {
  const urlPath = req.url === "/" ? "/index.html" : req.url;

  // Proxy upload requests to upload_resource.aspx (CORS workaround)
  if (req.method === "POST" && urlPath === "/api/upload") {
    const uploadUrl = req.headers["x-upload-url"];
    const apiKey = req.headers["x-api-key"];

    if (!uploadUrl || !apiKey) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing x-upload-url or x-api-key headers" }));
      return;
    }

    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", async () => {
      try {
        const body = Buffer.concat(chunks);
        const response = await fetch(uploadUrl, {
          method: "POST",
          headers: {
            "api-key": apiKey,
            "content-type": req.headers["content-type"],
          },
          body,
        });

        const responseText = await response.text();
        res.writeHead(response.status, {
          "Content-Type": response.headers.get("content-type") || "text/xml",
        });
        res.end(responseText);
      } catch (e) {
        res.writeHead(502, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: e.message || "Proxy error" }));
      }
    });
    return;
  }

  const filePath = join(STATIC_DIR, urlPath);

  // Prevent directory traversal
  if (!filePath.startsWith(STATIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  if (!existsSync(filePath)) {
    res.writeHead(404);
    res.end("Not Found");
    return;
  }

  const ext = extname(filePath);
  const contentType = MIME_TYPES[ext] || "application/octet-stream";

  res.writeHead(200, { "Content-Type": contentType });
  res.end(readFileSync(filePath));
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
