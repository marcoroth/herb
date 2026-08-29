import { createRequire } from "module"

import { yaml } from "./yaml-plugin.mjs"

const { dependencies } = createRequire(import.meta.url)("./package.json")
const runtimeDependencies = Object.keys(dependencies ?? {})

const nodeBuiltins = ["fs", "path"]

function isExternal(id) {
  return [...nodeBuiltins, ...runtimeDependencies].some(
    (pkg) => id === pkg || id.startsWith(pkg + "/")
  )
}

export default [
  {
    input: "src/index.ts",
    output: {
      file: "dist/herb-config.esm.js",
      format: "esm",
      sourcemap: true,
      codeSplitting: false,
    },
    external: isExternal,
    plugins: [yaml()],
  },

  {
    input: "src/index.ts",
    output: {
      file: "dist/herb-config.cjs",
      format: "cjs",
      sourcemap: true,
      codeSplitting: false,
    },
    external: isExternal,
    plugins: [yaml()],
  },

  {
    input: "src/config-schema.ts",
    output: {
      file: "dist/herb-config-schema.esm.js",
      format: "esm",
      sourcemap: true,
      codeSplitting: false,
    },
    external: isExternal,
    plugins: [yaml()],
  },

  {
    input: "src/config-schema.ts",
    output: {
      file: "dist/herb-config-schema.cjs",
      format: "cjs",
      sourcemap: true,
      codeSplitting: false,
    },
    external: isExternal,
    plugins: [yaml()],
  },
]
