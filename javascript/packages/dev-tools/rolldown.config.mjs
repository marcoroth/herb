import postcss from "rollup-plugin-postcss"

// rolldown rejects `.css` in the module graph outright, so `moduleTypes` hands
// the file over as JavaScript and lets the postcss plugin's transform, which
// returns the stylesheet as an injected JS module, be what rolldown parses.
// See https://github.com/rolldown/rolldown/issues/4271

export default [
  {
    input: "src/index.ts",
    output: {
      file: "dist/herb-dev-tools.esm.js",
      format: "esm",
      sourcemap: true,
    },
    platform: "browser",
    moduleTypes: { ".css": "js" },
    plugins: [
      postcss({
        inject: false,
        minimize: true,
      }),
    ],
  },
]
