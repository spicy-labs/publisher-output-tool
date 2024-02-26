// Import the exec function from the child_process module
import { exec } from 'child_process';
import * as util from "util";
import * as fs from "fs";
import * as os from "os";

(async () => {
  const bundleCommand = 'npx esbuild src/cli.js --bundle --platform=node --format=cjs --outfile=dist/bundled.js';

  //     const { stdout, stderr } = await util.promisify(exec)(bundleCommand);

  let [results, error] = await _try(
    () => util.promisify(exec)(bundleCommand),
    (e) => console.error(`exec esbuild error: ${e}`))

  if (error) return;
  console.log("bundle javascript");

  const configObject = {
    "main": "./dist/bundled.js",
    "output": "sea-prep.blob"
  };

  const jsonString = JSON.stringify(configObject, null, 2);

  [results, error] = await _try(
    async () => fs.writeFileSync("./sea-config.json", jsonString, "utf8"),
    (e) => console.error(`config write error: ${e}`)
  );

  if (error) return;
  console.log("generated config");

  const blobCommand = "node --experimental-sea-config sea-config.json";

  [results, error] = await _try(
    () => util.promisify(exec)(blobCommand),
    (e) => console.error(`exec blob gen error: ${e}`));

  if (error) return;
  console.log("generated blob");

  const targetFileName = os.platform() === 'win32' ? 'publisher-output-tool.exe' : 'publisher-output-tool';

  [results, error] = await _try(
    async () => fs.copyFileSync(process.execPath, `./${targetFileName}`),
    (e) => console.error(`config write error: ${e}`)
  )

  if (error) return;
  console.log("copied node executable");

  const injectArgs = {
    "NODE_SEA_BLOB": "sea-prep.blob",
    "--sentinel-fuse": "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2"
  }

  if (os.platform == "darwin") {
    injectArgs["--macho-segment-name"] = "NODE_SEA";
  }

  const injectCommand = `npx postject ${targetFileName} ` + Object.entries(injectArgs).reduce((str, [key, value], index, array) => {
    return str + key + ' ' + value + (index < array.length - 1 ? ' ' : '');
  }, '');

  [results, error] = await _try(
    () => util.promisify(exec)(injectCommand),
    (e) => console.error(`exec blob gen error: ${e}`))

  if (error) return;
  console.log("injected blob into exec");

})()


async function _try(fnc, handleErrorMessage) {

  try {
    return [await fnc(), null];
  }
  catch (e) {
    if (handleErrorMessage) { handleErrorMessage(e.toString()); }
    return [null, e];
  }
}
