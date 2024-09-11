import { exec } from 'child_process';
import * as util from "util";
import * as fs from "fs";
import * as os from "os";

const fileName = "publisher-output-tool";

(async () => {
  await bundle()

  if (os.platform() == "win32") {
    await macBuild(fileName);
    await cleanUp(`${fileName}.exe`);
  }
  else {
    await macBuild(fileName);
    await cleanUp(fileName);
  }
  process.exit(0);
})();

async function cleanUp(fileNameIgnore) {

  const directoryPath = "./dist/";

  let [result, error] = await _try(async () => {
    const files = fs.readdirSync(directoryPath);

    for (let file of files) {
      if (file !== fileNameIgnore) {
        fs.rmSync(directoryPath + file);
      }
    }
  });

  if (error) process.exit(1);
}

async function bundle() {
  const bundleCommand = 'npx esbuild src/cli.js --bundle --platform=node --format=cjs --outfile=dist/bundled.js';

  let [results, error] = await _try(
    () => util.promisify(exec)(bundleCommand),
    (e) => console.error(`exec esbuild error: ${e}`))

  if (error) process.exit(1);
  console.log("bundle javascript");
}


async function windowsBuild(fileName) {

  const configObject = {
    "main": "./dist/bundled.js",
    "output": "./dist/sea-prep.blob"
  };


  const jsonString = JSON.stringify(configObject, null, 2);

  let [results, error] = await _try(
    async () => fs.writeFileSync("./dist/sea-config.json", jsonString, "utf8"),
    (e) => console.error(`config write error: ${e}`)
  );

  if (error) process.exit(1);
  console.log("generated config");

  const blobCommand = "node --experimental-sea-config ./dist/sea-config.json";

  [results, error] = await _try(
    () => util.promisify(exec)(blobCommand),
    (e) => console.error(`exec blob gen error: ${e}`));

  if (error) process.exit(1);
  console.log("generated blob");

  const targetFileName = fileName + ".exe";

  [results, error] = await _try(
    async () => fs.copyFileSync(process.execPath, `./dist/${targetFileName}`),
    (e) => console.error(`exe copy error: ${e}`)
  )

  if (error) process.exit(1);
  console.log("copied node executable");

  const injectArgs = {
    "NODE_SEA_BLOB": "./dist/sea-prep.blob",
    "--sentinel-fuse": "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2"
  }

  const injectCommand = `npx postject ./dist/${targetFileName} ` + Object.entries(injectArgs).reduce((str, [key, value], index, array) => {
    return str + key + ' ' + value + (index < array.length - 1 ? ' ' : '');
  }, '');

  [results, error] = await _try(
    () => util.promisify(exec)(injectCommand),
    (e) => console.error(`exec blob gen error: ${e}`))

  if (error) process.exit(1);
  console.log("injected blob into exec");

}

async function macBuild(fileName) {
  const compileCommand = `bun build ./dist/bundled.js --compile --outfile ./dist/${fileName}`;

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
