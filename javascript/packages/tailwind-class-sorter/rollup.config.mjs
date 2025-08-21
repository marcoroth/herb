import typescript from "@rollup/plugin-typescript"
import { nodeResolve } from "@rollup/plugin-node-resolve"
import commonjs from "@rollup/plugin-commonjs"
import json from "@rollup/plugin-json"

export default [
  {
    input: "src/index.ts",
    output: {
      file: "dist/tailwind-class-sorter.esm.js",
      format: "esm",
      sourcemap: true,
    },
    external: ["tailwindcss", "tailwindcss/loadConfig", "tailwindcss/resolveConfig", "fs/promises", "path", "url"],
    plugins: [
      nodeResolve({ preferBuiltins: true }),
      commonjs(),
      json(),
      typescript({
        tsconfig: "./tsconfig.json",
        declaration: true,
        declarationDir: "./dist/types",
        rootDir: "src/",
      }),
    ],
  },

  {
    input: "src/index.ts",
    output: {
      file: "dist/tailwind-class-sorter.cjs",
      format: "cjs",
      sourcemap: true,
    },
    external: ["tailwindcss", "tailwindcss/loadConfig", "tailwindcss/resolveConfig", "fs/promises", "path", "url"],
    plugins: [
      nodeResolve({ preferBuiltins: true }),
      commonjs(),
      json(),
      typescript({
        tsconfig: "./tsconfig.json",
        rootDir: "src/",
      }),
    ],
  },
]
