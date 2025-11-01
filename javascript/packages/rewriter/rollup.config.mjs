import typescript from "@rollup/plugin-typescript"
import { nodeResolve } from "@rollup/plugin-node-resolve"
import commonjs from "@rollup/plugin-commonjs"
import json from "@rollup/plugin-json"

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
  {
    input: "src/index.ts",
    output: {
      file: "dist/index.esm.js",
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
    input: "src/index.ts",
    output: {
      file: "dist/index.cjs",
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
