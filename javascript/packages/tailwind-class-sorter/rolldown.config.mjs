import { createRequire } from "module"

const { dependencies, peerDependencies } = createRequire(import.meta.url)("./package.json")
const runtimeDependencies = [
  ...Object.keys(dependencies ?? {}),
  ...Object.keys(peerDependencies ?? {}),
]

const nodeBuiltins = ["fs", "fs/promises", "path", "url"]

function isExternal(id) {
  return [...nodeBuiltins, ...runtimeDependencies].some(
    (pkg) => id === pkg || id.startsWith(pkg + "/")
  )
}

export default [
  {
    input: "src/index.ts",
    output: {
      file: "dist/tailwind-class-sorter.esm.js",
      format: "esm",
      sourcemap: true,
    },
    external: isExternal,
    platform: "node",
  },

  {
    input: "src/index.ts",
    output: {
      file: "dist/tailwind-class-sorter.cjs",
      format: "cjs",
      sourcemap: true,
    },
    external: isExternal,
    platform: "node",
  },
]
