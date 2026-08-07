import typescript from "@rollup/plugin-typescript"
import json from "@rollup/plugin-json"
import { nodeResolve } from "@rollup/plugin-node-resolve"

export default {
  input: "src/index.ts",
  output: [
    {
      file: "dist/herb-node-wasm.esm.js",
      format: "esm",
      sourcemap: false,
    },
    {
      file: "dist/herb-node-wasm.cjs",
      format: "cjs",
      sourcemap: false,
    }
  ],
  external: [/@ruby\/prism/],
  plugins: [
    nodeResolve(),
    json(),
    typescript({
      tsconfig: "./tsconfig.json",
      declaration: true,
      declarationDir: "./dist/types",
      rootDir: "src/",
    }),
  ],
}
