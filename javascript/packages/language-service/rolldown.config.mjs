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
