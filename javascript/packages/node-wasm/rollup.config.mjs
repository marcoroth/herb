import typescript from "@rollup/plugin-typescript"
import json from "@rollup/plugin-json"
import { nodeResolve } from "@rollup/plugin-node-resolve"

export default {
  input: "src/index.ts",
  output: [
    {
      file: "dist/herb-node-wasm.esm.js",
      format: "esm",
      sourcemap: true,
    }
  ],
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
