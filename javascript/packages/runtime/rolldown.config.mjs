export default [
  {
    input: "src/index.ts",
    output: {
      file: "dist/herb-runtime.esm.js",
      format: "esm",
      minify: true,
    },
    platform: "browser",
  }
]
