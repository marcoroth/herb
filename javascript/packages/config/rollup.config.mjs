import typescript from "@rollup/plugin-typescript"
import json from "@rollup/plugin-json"
import { nodeResolve } from "@rollup/plugin-node-resolve"
import { yaml } from "./yaml-plugin.mjs"

export default [
  {
    input: "src/index.ts",
    output: {
      file: "dist/herb-config.esm.js",
      format: "esm",
      sourcemap: true,
    },
    external: ["yaml", "fs", "path", "picomatch", "tinyglobby"],
    plugins: [
      nodeResolve(),
      json(),
      yaml(),
      typescript({
        tsconfig: "./tsconfig.json",
        declaration: true,
        declarationDir: "./dist/types",
        rootDir: "src/",
      }),
    ],
  },

  {
    input: "src/index.ts",
    output: {
      file: "dist/herb-config.cjs",
      format: "cjs",
      sourcemap: true,
    },
    external: ["yaml", "fs", "path", "picomatch", "tinyglobby"],
    plugins: [
      nodeResolve(),
      json(),
      yaml(),
      typescript({
        tsconfig: "./tsconfig.json",
        rootDir: "src/",
      }),
    ],
  },
]
