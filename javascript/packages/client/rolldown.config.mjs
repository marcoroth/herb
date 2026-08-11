export default [
  {
    input: "src/index.ts",
    output: {
      file: "dist/herb-client.esm.js",
      format: "esm",
      sourcemap: true,
    },
    platform: "browser",
  },
  {
    input: "src/index.ts",
    output: {
      file: "dist/herb-client.umd.js",
      format: "umd",
      name: "HerbClient",
      sourcemap: true,
    },
    platform: "browser",
  },
]
