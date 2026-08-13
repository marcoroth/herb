export default [
  {
    input: "src/index.ts",
    output: {
      file: "dist/herb-client.esm.js",
      format: "esm",
      minify: true,
    },
    platform: "browser",
  }
]
