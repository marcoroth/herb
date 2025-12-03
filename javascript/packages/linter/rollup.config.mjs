import typescript from "@rollup/plugin-typescript"
import { nodeResolve } from "@rollup/plugin-node-resolve"
import json from "@rollup/plugin-json"
import commonjs from "@rollup/plugin-commonjs"

// Bundle the CLI entry point into a single CommonJS file.
// Exclude Node built-in so they remain as externals.
const external = [
  "path",
  "url",
  "fs",
  "module",
]

function isExternal(id) {
  return (
    external.includes(id) ||
    external.some((pkg) => id === pkg || id.startsWith(pkg + "/"))
  )
}

export default [
  // CLI entry point (CommonJS)
  {
    input: "src/herb-lint.ts",
    output: {
      file: "dist/herb-lint.js",
      format: "cjs",
      sourcemap: true,
    },
    external: isExternal,
    plugins: [
      nodeResolve(),
      commonjs(),
      json(),
      typescript({
        tsconfig: "./tsconfig.json",
        rootDir: "src/",
        module: "esnext",
      }),
    ],
  },

  // Library exports (ESM)
  {
    input: "src/index.ts",
    output: {
      file: "dist/index.js",
      format: "esm",
      sourcemap: true,
    },
    external: ["@herb-tools/core", "@herb-tools/node-wasm"],
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

  // Library exports (CommonJS)
  {
    input: "src/index.ts",
    output: {
      file: "dist/index.cjs",
      format: "cjs",
      sourcemap: true,
    },
    external: ["@herb-tools/core", "@herb-tools/node-wasm"],
    plugins: [
      nodeResolve(),
      commonjs(),
      json(),
      typescript({
        tsconfig: "./tsconfig.json",
        rootDir: "src/",
        module: "esnext",
      }),
    ],
  },

  // Loader entry point (includes custom rule loader)
  {
    input: "src/loader.ts",
    output: {
      file: "dist/loader.js",
      format: "esm",
      sourcemap: true,
    },
    external,
    plugins: [
      nodeResolve({ preferBuiltins: true }),
      commonjs(),
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
    input: "src/loader.ts",
    output: {
      file: "dist/loader.cjs",
      format: "cjs",
      sourcemap: true,
    },
    external,
    plugins: [
      nodeResolve({ preferBuiltins: true }),
      commonjs(),
      json(),
      typescript({
        tsconfig: "./tsconfig.json",
        rootDir: "src/",
      }),
    ],
  },
]
