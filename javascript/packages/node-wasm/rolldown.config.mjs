import { renameEmscriptenNodeRequire } from "./libherb-plugin.mjs"

export default {
  input: "src/index.ts",
  output: [
    {
      file: "dist/herb-node-wasm.esm.js",
      format: "esm",
      sourcemap: true,
    },
    {
      file: "dist/herb-node-wasm.cjs",
      format: "cjs",
      sourcemap: true,
    }
  ],
  external: [/@ruby\/prism/],
  platform: "node",
  plugins: [renameEmscriptenNodeRequire()],
}
