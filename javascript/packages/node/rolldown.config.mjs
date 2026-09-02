import { createRequire } from "module"

const { dependencies } = createRequire(import.meta.url)("./package.json")
const runtimeDependencies = Object.keys(dependencies ?? {})

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
    id.endsWith(".html") ||
    id.endsWith(".node") ||
    [...external, ...runtimeDependencies].some(
      (pkg) => id === pkg || id.startsWith(pkg + "/")
    )
  )
}

export default [
  {
    input: "src/index.ts",
    output: {
      file: "dist/herb-node.esm.js",
      format: "esm",
      sourcemap: true,
    },
    external: isExternal,
  },

  {
    input: "src/index.ts",
    output: {
      file: "dist/herb-node.cjs",
      format: "cjs",
      sourcemap: true,
    },
    external: isExternal,
    resolve: { extensions: [".js", ".ts", ".cts"] },
  },
]
