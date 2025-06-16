import typescript from "@rollup/plugin-typescript";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import json from "@rollup/plugin-json";

const external = ["@herb-tools/core"];

export default [
  {
    input: "src/index.ts",
    output: {
      file: "dist/herb-formatter.esm.js",
      format: "esm",
      sourcemap: true,
    },
    external,
    plugins: [
      nodeResolve(),
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
      file: "dist/herb-formatter.cjs",
      format: "cjs",
      sourcemap: true,
    },
    external,
    plugins: [
      nodeResolve(),
      json(),
      typescript({
        tsconfig: "./tsconfig.json",
        rootDir: "src/",
      }),
    ],
  },
];
