export default [
  {
    input: {
      "herb-client": "src/index.ts",
      "herb-client-stimulus": "src/stimulus.ts",
      "herb-client-directives": "src/directives.ts",
    },
    output: {
      dir: "dist",
      format: "esm",
      entryFileNames: "[name].esm.js",
      chunkFileNames: "herb-client-shared-[hash].esm.js",
      minify: true,
    },
    platform: "browser",
  },
  {
    input: { "herb-client-directives": "src/directives.ts" },
    output: {
      dir: "dist",
      format: "cjs",
      entryFileNames: "[name].cjs",
      minify: true,
    },
    platform: "neutral",
  },
]
