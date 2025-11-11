#!/usr/bin/env node

import fs from "fs/promises"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function copyDir(src, dest) {
  await fs.mkdir(dest, { recursive: true })
  const entries = await fs.readdir(src, { withFileTypes: true })

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)

    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath)
    } else {
      await fs.copyFile(srcPath, destPath)
    }
  }
}

async function main() {
  const playgroundSrc = path.join(__dirname, "../../../../playground/dist")
  const playgroundDest = path.join(__dirname, "../dist/playground")

  try {
    await fs.access(playgroundSrc)

    console.log("Bundling playground into CLI package...")

    try {
      await fs.rm(playgroundDest, { recursive: true, force: true })
    } catch (error) {
      // Ignore
    }

    await copyDir(playgroundSrc, playgroundDest)

    console.log("✓ Playground bundled successfully")
  } catch (error) {
    console.warn("⚠ Warning: Could not bundle playground")
    console.warn("  Playground dist not found at:", playgroundSrc)
    console.warn("  Run 'cd playground && yarn build' to build the playground first")
    console.warn("  The CLI will still work for other commands")
  }
}

main().catch((error) => {
  console.error("Error bundling playground:", error)
  process.exit(1)
})
