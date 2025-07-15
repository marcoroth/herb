import typescript from "@rollup/plugin-typescript"
import { nodeResolve } from "@rollup/plugin-node-resolve"
import json from "@rollup/plugin-json"

const external = [
  // ...
]

export default [
  // CLI build
  {
    input: "src/herb-formatter.ts",
    output: {
      file: "dist/herb-formatter.js",
      format: "esm",
      sourcemap: true,
    },
    external,
    plugins: [
      nodeResolve(),
      json(),
      typescript({
        tsconfig: "./tsconfig.json",
        rootDir: "src/",
        module: "esnext",
      }),
    ],
  },
  {
    input: "src/index.ts",
    output: {
      file: "dist/index.esm.js",
      format: "esm",
      sourcemap: true,
    },
    external,
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
  },
  {
    input: "src/index.ts",
    output: {
      file: "dist/index.cjs",
      format: "cjs",
      sourcemap: true,
    },
    external,
    plugins: [
      nodeResolve(),
      json(),
      typescript({
        tsconfig: "./tsconfig.json",
        rootDir: "src/",
      }),
    ],
  },
]
