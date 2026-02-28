import * as esbuild from "esbuild";
import * as fs from "fs";

await esbuild.build({
  entryPoints: ["frontend/app.tsx"],
  bundle: true,
  outdir: "dist/frontend",
  format: "esm",
  minify: true,
  sourcemap: true,
});

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

fs.writeFileSync("dist/frontend/index.html", html);
console.log("Frontend built to dist/frontend/");
