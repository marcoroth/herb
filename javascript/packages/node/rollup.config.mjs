import typescript from "@rollup/plugin-typescript"
import { nodeResolve } from "@rollup/plugin-node-resolve"
import json from "@rollup/plugin-json"

const external = [
  "node-addon-api",
  "fs",
  "path",
  "url",
  "module",
  "@mapbox/node-pre-gyp",
  "@herb-tools/core",
]

function isExternal(id) {
  return (
    external.includes(id) ||
    id.endsWith(".html") ||
    id.endsWith(".node") ||
    id.startsWith("@herb-tools/core")
  )
}

export default [
  {
    input: "src/index-esm.mts",
    output: {
      file: "dist/herb-node.esm.js",
      format: "esm",
      sourcemap: true,
    },
    external: isExternal,
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
    input: "src/index-cjs.cts",
    output: {
      file: "dist/herb-node.cjs",
      format: "cjs",
      sourcemap: true,
    },
    external: isExternal,
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
