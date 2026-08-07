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
  // CLI build
  {
    input: "src/herb-format.ts",
    output: {
      file: "dist/herb-format.js",
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
  {
    input: "src/index.ts",
    output: {
      file: "dist/index.esm.js",
      format: "esm",
      sourcemap: true,
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
      sourcemap: true,
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
