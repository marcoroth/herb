import * as esbuild from "esbuild"

await esbuild.build({
  entryPoints: ["./dist/src/index.js"],
  bundle: true,
  format: "esm",
  outfile: "./dist/herb-core.esm.js",
  platform: "node",
  external: ["node-addon-api", "fs", "path", "url"],
  conditions: ["import"],
  target: ["es2020"],
})

await esbuild.build({
  entryPoints: ["./dist/src/index.js"],
  bundle: true,
  format: "cjs",
  outfile: "./dist/herb-core.cjs",
  platform: "node",
  external: ["node-addon-api", "fs", "path"],
})

await esbuild.build({
  entryPoints: ["./dist/src/index.js"],
  bundle: true,
  format: "esm",
  outfile: "./dist/herb-core.browser.js",
  platform: "browser",
})

await esbuild.build({
  entryPoints: ["./dist/src/index.js"],
  bundle: true,
  format: "iife",
  globalName: "Herb",
  outfile: "./dist/herb-core.umd.js",
  platform: "browser",
})
