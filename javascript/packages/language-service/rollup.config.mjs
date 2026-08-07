import typescript from "@rollup/plugin-typescript"
import { nodeResolve } from "@rollup/plugin-node-resolve"

const external = [
  "@herb-tools/core",
  "@herb-tools/node-wasm",
  "@herb-tools/browser",
  "vscode-html-languageservice",
  "vscode-languageserver-textdocument",
]

export default [
  {
    input: "src/index.ts",
    output: {
      file: "dist/herb-language-service.esm.js",
      format: "esm",
      sourcemap: false,
    },
    external,
    plugins: [
      nodeResolve(),
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
      file: "dist/herb-language-service.cjs",
      format: "cjs",
      sourcemap: false,
    },
    external,
    plugins: [
      nodeResolve(),
      typescript({
        tsconfig: "./tsconfig.json",
        rootDir: "src/",
      }),
    ],
  },
]
