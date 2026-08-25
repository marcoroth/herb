export default [
  {
    input: "src/index.ts",
    output: {
      file: "dist/herb-core.esm.js",
      format: "esm",
      sourcemap: true,
    },
    external: ["node-addon-api", "fs", "path", "url", /@ruby\/prism/],
  },

  {
    input: "src/index.ts",
    output: {
      file: "dist/herb-core.cjs",
      format: "cjs",
      sourcemap: true,
    },
    external: ["node-addon-api", "fs", "path", /@ruby\/prism/],
  },

  {
    input: "src/index.ts",
    output: {
      file: "dist/herb-core.browser.js",
      format: "esm",
      sourcemap: true,
    },
    external: [/@ruby\/prism/],
    platform: "browser",
  },

  {
    input: "src/index.ts",
    output: {
      file: "dist/herb-core.umd.js",
      format: "umd",
      name: "Herb",
      sourcemap: true,
    },
    external: [/@ruby\/prism/],
    platform: "browser",
  },
]
