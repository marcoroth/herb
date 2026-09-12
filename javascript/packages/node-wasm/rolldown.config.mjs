import { createRequire } from "module"

const { dependencies } = createRequire(import.meta.url)("./package.json")
const runtimeDependencies = Object.keys(dependencies ?? {})

export default {
  input: "src/index.ts",
  output: [
    {
      file: "dist/herb-node-wasm.esm.js",
      format: "esm",
      sourcemap: true,
    },
    {
      file: "dist/herb-node-wasm.cjs",
      format: "cjs",
      sourcemap: true,
    }
  ],
  external: (id) => runtimeDependencies.some((pkg) => id === pkg || id.startsWith(pkg + "/")),
  platform: "node",
}
