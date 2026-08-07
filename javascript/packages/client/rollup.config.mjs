import typescript from "@rollup/plugin-typescript"
import { nodeResolve } from "@rollup/plugin-node-resolve"

export default [
  {
    input: "src/index.ts",
    output: {
      file: "dist/herb-client.esm.js",
      format: "esm",
      sourcemap: false,
    },
    plugins: [
      nodeResolve({ browser: true }),
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
      file: "dist/herb-client.umd.js",
      format: "umd",
      name: "HerbClient",
      sourcemap: false,
    },
    plugins: [
      nodeResolve({ browser: true }),
      typescript({
        tsconfig: "./tsconfig.json",
        declaration: false,
        rootDir: "src/",
      }),
    ],
  },
]
