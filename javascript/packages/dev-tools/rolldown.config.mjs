import postcss from "rollup-plugin-postcss"

// rolldown rejects `.css` in the module graph outright, so `moduleTypes` hands
// the file over as JavaScript and lets the postcss plugin's transform, which
// returns the stylesheet as an injected JS module, be what rolldown parses.
// See https://github.com/rolldown/rolldown/issues/4271

// `@herb-tools/highlighter` renders for a terminal, so its browser entry still
// reads `process.env.NO_COLOR` and `process.stdout`. Substituting those three
// expressions leaves the host page's own globals untouched, which defining a
// global `process` shim would not.
export const browserDefines = {
  "process.env.NO_COLOR": "undefined",
  "process.stdout.isTTY": "false",
  "process.stdout.columns": "0",
}

export default [
  {
    input: "src/index.ts",
    output: {
      file: "dist/herb-dev-tools.esm.js",
      format: "esm",
      sourcemap: true,
      inlineDynamicImports: true,
    },
    platform: "browser",
    transform: { define: browserDefines },
    moduleTypes: { ".css": "js" },
    plugins: [
      postcss({
        inject: false,
        minimize: true,
      }),
    ],
  },
]
