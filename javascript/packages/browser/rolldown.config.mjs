export default {
  input: "src/index.ts",
  output: [
    {
      file: "dist/herb-browser.esm.js",
      format: "esm",
      sourcemap: true,
    },
    {
      file: "dist/herb-browser.umd.js",
      format: "iife",
      name: "Herb",
      sourcemap: true,
    },
  ],
  external: [/@ruby\/prism/],
  platform: "browser",
}
