import { exec } from 'child_process';
import * as util from "util";
import * as os from "os";

const fileName = "publisher-output-tool";

(async () => {
  await bundle();
  await compile(fileName);
  process.exit(0);
})();

async function bundle() {
  const bundleCommand = 'npx esbuild src/cli.js --bundle --platform=node --format=cjs --outfile=dist/bundled.js';

  let [results, error] = await _try(
    () => util.promisify(exec)(bundleCommand),
    (e) => console.error(`exec esbuild error: ${e}`))

  if (error) process.exit(1);
  console.log("bundle javascript");
}

async function compile(fileName) {
  const targetFileName = os.platform() === "win32" ? `${fileName}.exe` : fileName;
  const compileCommand = `bun build ./dist/bundled.js --compile --outfile ./dist/${targetFileName}`;

  let [results, error] = await _try(
    () => util.promisify(exec)(compileCommand),
    (e) => console.error(`compile command error: ${e}`));

  if (error) process.exit(1);
  console.log("generated executable");
}

async function _try(fnc, handleErrorMessage) {

  try {
    return [await fnc(), null];
  }
  catch (e) {
    if (handleErrorMessage) { handleErrorMessage(e.toString()); }
    return [null, e];
  }
}
