export default {
  input: {
    "herb-client": "src/index.ts",
    "herb-client-stimulus": "src/stimulus.ts",
  },
  output: {
    dir: "dist",
    format: "esm",
    entryFileNames: "[name].esm.js",
    chunkFileNames: "herb-client-shared-[hash].esm.js",
    minify: true,
  },
  platform: "browser",
}
