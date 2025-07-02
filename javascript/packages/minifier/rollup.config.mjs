import json from "@rollup/plugin-json"
import resolve from "@rollup/plugin-node-resolve"
import commonjs from "@rollup/plugin-commonjs"
import typescript from "@rollup/plugin-typescript"

const globals = {
  '@herb-tools/core': 'HerbCore',
  '@herb-tools/node-wasm': 'HerbNodeWasm',
  '@herb-tools/printer': 'HerbPrinter'
}

export default [
  {
    input: "./src/index.ts",
    external: Object.keys(globals),
    output: [
      {
        file: "./dist/index.js",
        format: "es",
        sourcemap: true,
      },
      {
        file: "./dist/index.cjs",
        format: "cjs",
        sourcemap: true,
      },
    ],
    plugins: [
      resolve({
        preferBuiltins: true,
      }),
      commonjs(),
      json(),
      typescript({
        declaration: false,
        declarationMap: false,
        exclude: ["test/**/*"]
      }),
    ],
  },
  {
    input: "./src/cli.ts",
    external: Object.keys(globals),
    output: {
      file: "./dist/cli.js",
      format: "es",
      sourcemap: true,
    },
    plugins: [
      resolve({
        preferBuiltins: true,
      }),
      commonjs(),
      json(),
      typescript({
        declaration: false,
        declarationMap: false,
        exclude: ["test/**/*"]
      }),
    ],
  },
]
