import * as esbuild from "esbuild"

await esbuild.build({
  entryPoints: ["./dist/src/index.js"],
  bundle: true,
  format: "esm",
  outfile: "./dist/herb-node.esm.js",
  platform: "node",
  external: [
    "node-addon-api",
    "fs",
    "path",
    "url",
    "nock",
    "aws-sdk",
    "mock-aws-s3",
    "*.html",
  ],
  conditions: ["import"],
  target: ["es2020"],
})

// await esbuild.build({
//   entryPoints: ["./dist/src/index.js"],
//   bundle: true,
//   format: "cjs",
//   outfile: "./dist/herb-node.cjs",
//   platform: "node",
//   external: ["node-addon-api", "fs", "path"],
// });
