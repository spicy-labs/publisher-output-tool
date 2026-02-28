import { rmSync } from "fs";

rmSync("dist/frontend", { recursive: true, force: true });

const result = await Bun.build({
  entrypoints: ["frontend/app.tsx"],
  outdir: "dist/frontend",
  minify: true,
  sourcemap: "linked",
});

if (!result.success) {
  console.error("Build failed:");
  for (const log of result.logs) {
    console.error(log);
  }
  process.exit(1);
}

// Generate index.html pointing to built assets
const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Publisher Output Tool</title>
  <link rel="stylesheet" href="./app.css">
</head>
<body>
  <div id="root"></div>
  <script type="module" src="./app.js"></script>
</body>
</html>`;

await Bun.write("dist/frontend/index.html", html);
console.log("Frontend built to dist/frontend/");
