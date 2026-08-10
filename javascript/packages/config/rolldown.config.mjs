import { yaml } from "./yaml-plugin.mjs"

export default [
  {
    input: "src/index.ts",
    output: {
      file: "dist/herb-config.esm.js",
      format: "esm",
      sourcemap: true,
      codeSplitting: false,
    },
    external: ["yaml", "fs", "path", "picomatch", "tinyglobby"],
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
    external: ["yaml", "fs", "path", "picomatch", "tinyglobby"],
    plugins: [yaml()],
  },
]
