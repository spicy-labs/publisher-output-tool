import index from "../frontend/index.html";

Bun.serve({
  port: 3000,
  routes: {
    "/": index,
    // Proxy upload requests to upload_resource.aspx (CORS workaround)
    "/api/upload": {
      POST: async (req) => {
        const uploadUrl = req.headers.get("x-upload-url");
        const apiKey = req.headers.get("x-api-key");

        if (!uploadUrl || !apiKey) {
          return Response.json({ error: "Missing x-upload-url or x-api-key headers" }, { status: 400 });
        }

        try {
          const response = await fetch(uploadUrl, {
            method: "POST",
            headers: {
              "api-key": apiKey,
              "content-type": req.headers.get("content-type"),
            },
            body: await req.arrayBuffer(),
          });

          return new Response(await response.text(), {
            status: response.status,
            headers: { "Content-Type": response.headers.get("content-type") || "text/xml" },
          });
        } catch (e) {
          return Response.json({ error: e.message || "Proxy error" }, { status: 502 });
        }
      },
    },
  },
  development: {
    hmr: true,
    console: true,
  },
});

console.log("Server running on http://localhost:3000");
