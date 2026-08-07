import typescript from "@rollup/plugin-typescript"
import { nodeResolve } from "@rollup/plugin-node-resolve"
import commonjs from "@rollup/plugin-commonjs"
import json from "@rollup/plugin-json"
import { createRequire } from "module"

const external = [
  "path",
  "url",
  "fs",
  "module",
]

const { dependencies } = createRequire(import.meta.url)("./package.json")
const runtimeDependencies = Object.keys(dependencies ?? {})

function isExternal(id) {
  return [...external, ...runtimeDependencies].some(
    (pkg) => id === pkg || id.startsWith(pkg + "/")
  )
}

export default [
  // Browser-compatible entry point (core APIs only)
  {
    input: "src/index.ts",
    output: {
      file: "dist/index.esm.js",
      format: "esm",
      sourcemap: false,
    },
    external: isExternal,
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
    input: "src/index.ts",
    output: {
      file: "dist/index.cjs",
      format: "cjs",
      sourcemap: false,
    },
    external: isExternal,
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

  // Loader entry point (includes built-in rewriters and custom rewriter loader)
  {
    input: "src/loader.ts",
    output: {
      file: "dist/loader.esm.js",
      format: "esm",
      sourcemap: false,
    },
    external: isExternal,
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
      sourcemap: false,
    },
    external: isExternal,
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
