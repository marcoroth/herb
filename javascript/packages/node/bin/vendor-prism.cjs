#!/usr/bin/env node

const fs = require("fs")
const path = require("path")
const { execSync } = require("child_process")

const prismPath = execSync("bundle show prism").toString().trim()
console.log(`Found Prism at: ${prismPath}`)

const targetDir = path.resolve(__dirname, "../extension/prism")
const targetIncludeDir = path.resolve(targetDir, "include")
const targetSrcDir = path.resolve(targetDir, "src")
const targetUtilDir = path.resolve(targetSrcDir, "util")

function ensureDirectoryExists(dir) {
  if (!fs.existsSync(dir)) {
    console.log(`Creating directory: ${dir}`)
    fs.mkdirSync(dir, { recursive: true })
  }
}

ensureDirectoryExists(targetIncludeDir)
ensureDirectoryExists(targetSrcDir)
ensureDirectoryExists(targetUtilDir)

function safeCopyFile(sourcePath, targetPath) {
  try {
    const stats = fs.statSync(sourcePath)
    if (!stats.isFile()) {
      console.log(`Skipping non-file: ${sourcePath}`)
      return
    }

    const content = fs.readFileSync(sourcePath)
    fs.writeFileSync(targetPath, content)
    console.log(`Copied: ${sourcePath} -> ${targetPath}`)
  } catch (error) {
    console.error(`Error copying ${sourcePath}: ${error.message}`)
  }
}

function copyDirectory(sourceDir, targetDir) {
  if (!fs.existsSync(sourceDir)) {
    return
  }

  ensureDirectoryExists(targetDir)

  const entries = fs.readdirSync(sourceDir, { withFileTypes: true })

  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name)
    const targetPath = path.join(targetDir, entry.name)

    if (entry.isDirectory()) {
      copyDirectory(sourcePath, targetPath)
    } else if (entry.isFile()) {
      safeCopyFile(sourcePath, targetPath)
    } else {
      console.log(`Skipping non-file/directory: ${sourcePath}`)
    }
  }
}

console.log("Copying include files...")
const includeDir = path.join(prismPath, "include")
copyDirectory(includeDir, targetIncludeDir)

const prismHeader = path.join(prismPath, "src", "prism.h")
if (fs.existsSync(prismHeader)) {
  safeCopyFile(prismHeader, path.join(targetIncludeDir, "prism.h"))
}

console.log("Copying source files...")
const srcDir = path.join(prismPath, "src")
copyDirectory(srcDir, targetSrcDir)

console.log("Prism source files copied successfully!")
