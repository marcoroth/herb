import typescript from "@rollup/plugin-typescript"
import { nodeResolve } from "@rollup/plugin-node-resolve"
import json from "@rollup/plugin-json"
import postcss from "rollup-plugin-postcss"

export default [
  {
    input: "src/index.ts",
    output: {
      file: "dist/herb-dev-tools.esm.js",
      format: "esm",
      sourcemap: true,
    },
    plugins: [
      nodeResolve({ browser: true }),
      json(),
      postcss({
        inject: true,
        minimize: true,
      }),
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
      file: "dist/herb-dev-tools.umd.js",
      format: "umd",
      name: "HerbDevTools",
      sourcemap: true
    },
    plugins: [
      nodeResolve({ browser: true }),
      json(),
      postcss({
        inject: true,
        minimize: true,
      }),
      typescript({
        tsconfig: "./tsconfig.json",
        declaration: false,
        rootDir: "src/",
      }),
    ],
  },
]
