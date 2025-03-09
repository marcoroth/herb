import * as esbuild from "esbuild"

await esbuild.build({
  entryPoints: ["./dist/src/index.js"],
  bundle: true,
  format: "esm",
  outfile: "./dist/herb-browser.esm.js",
  platform: "browser",
})

await esbuild.build({
  entryPoints: ["./dist/src/index.js"],
  bundle: true,
  format: "iife",
  globalName: "Herb",
  outfile: "./dist/herb-browser.umd.js",
  platform: "browser",
})
