import typescript from "@rollup/plugin-typescript"
import { nodeResolve } from "@rollup/plugin-node-resolve"
import json from "@rollup/plugin-json"
import commonjs from "@rollup/plugin-commonjs"

// Bundle the LSP server entry point into a single CommonJS file.
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

export default {
  input: "src/index.ts",
  output: {
    file: "dist/herb-language-server.js",
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
}
