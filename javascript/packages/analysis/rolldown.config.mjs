const external = [
  "@herb-tools/core",
  "picomatch",
  "tinyglobby",
  "node:fs",
  "node:path",
]

const entries = [
  ["src/index.ts", "herb-analysis"],
  ["src/node.ts", "herb-analysis-node"],
]

export default entries.flatMap(([input, name]) => [
  { input, output: { file: `dist/${name}.esm.js`, format: "esm", sourcemap: true }, external },
  { input, output: { file: `dist/${name}.cjs`, format: "cjs", sourcemap: true }, external },
])
