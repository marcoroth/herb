import * as esbuild from "esbuild"
import { wasmLoader } from "esbuild-plugin-wasm"

await esbuild.build({
  entryPoints: ["./src/index.ts"],
  bundle: true,
  format: "esm",
  outfile: "./dist/herb-browser.esm.js",
  platform: "browser",
})

// await esbuild.build({
//   entryPoints: ["./dist/src/index.js"],
//   bundle: true,
//   format: "iife",
//   globalName: "Herb",
//   outfile: "./dist/herb-browser.umd.js",
//   platform: "browser",
//   plugins: [
//     wasmLoader({
//       mode: "inline"
//     })
//   ],
//   external: ["env", "wasi_snapshot_preview1"],
// })
