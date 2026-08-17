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
