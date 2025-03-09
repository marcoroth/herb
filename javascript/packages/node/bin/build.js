// bin/build.js - Simple build script
import * as esbuild from "esbuild"

// Common configuration
const commonConfig = {
  bundle: true,
  platform: "node",
  target: ["es2020"],
  minify: false,
  sourcemap: true,
  external: [
    "node-addon-api",
    "fs",
    "path",
    "url",
    "module",
    "@mapbox/node-pre-gyp",
    "*.html",
    "*.node",
  ],
}

// Build both versions
async function build() {
  try {
    console.log("Starting build process...")

    console.log("Building ESM version...")
    await esbuild.build({
      ...commonConfig,
      entryPoints: ["./dist/src/index-esm.mjs"],
      format: "esm",
      outfile: "./dist/herb-node.esm.js",
    })

    console.log("Building CommonJS version...")
    await esbuild.build({
      ...commonConfig,
      entryPoints: ["./dist/src/index-cjs.cjs"],
      format: "cjs",
      outfile: "./dist/herb-node.cjs",
    })

    console.log("Build completed successfully!")
  } catch (error) {
    console.error("Build failed:", error)
    process.exit(1)
  }
}

// Run the build
build()
