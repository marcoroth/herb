import typescript from "@rollup/plugin-typescript"
import { nodeResolve } from "@rollup/plugin-node-resolve"
import json from "@rollup/plugin-json"

export default [
  {
    input: "src/index.ts",
    output: {
      file: "dist/herb-core.esm.js",
      format: "esm",
      sourcemap: true,
    },
    external: ["node-addon-api", "fs", "path", "url"],
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
      file: "dist/herb-core.cjs",
      format: "cjs",
      sourcemap: true,
    },
    external: ["node-addon-api", "fs", "path"],
    plugins: [
      nodeResolve(),
      json(),
      typescript({
        tsconfig: "./tsconfig.json",
        rootDir: "src/",
      }),
    ],
  },

  {
    input: "src/index.ts",
    output: {
      file: "dist/herb-core.browser.js",
      format: "esm",
      sourcemap: true,
    },
    plugins: [
      nodeResolve({ browser: true }),
      json(),
      typescript({
        tsconfig: "./tsconfig.json",
        rootDir: "src/",
      }),
    ],
  },

  {
    input: "src/index.ts",
    output: {
      file: "dist/herb-core.umd.js",
      format: "umd",
      name: "Herb",
      sourcemap: true,
    },
    plugins: [
      nodeResolve({ browser: true }),
      json(),
      typescript({
        tsconfig: "./tsconfig.json",
        rootDir: "src/",
      }),
    ],
  },
]
