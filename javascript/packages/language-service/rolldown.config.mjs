import { createRequire } from "module"

const { dependencies, peerDependencies } = createRequire(import.meta.url)("./package.json")
const runtimeDependencies = [
  ...Object.keys(dependencies ?? {}),
  ...Object.keys(peerDependencies ?? {}),
]

function external(id) {
  return runtimeDependencies.some((pkg) => id === pkg || id.startsWith(pkg + "/"))
}

export default [
  {
    input: "src/index.ts",
    output: {
      file: "dist/herb-language-service.esm.js",
      format: "esm",
      sourcemap: true,
    },
    external,
  },

  {
    input: "src/index.ts",
    output: {
      file: "dist/herb-language-service.cjs",
      format: "cjs",
      sourcemap: true,
    },
    external,
  },
]
