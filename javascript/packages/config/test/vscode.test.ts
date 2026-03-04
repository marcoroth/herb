import { describe, test, expect, beforeEach, afterEach } from "vitest"
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"

import { addHerbExtensionRecommendation, getExtensionsJsonRelativePath } from "../src/vscode.js"

import type { VSCodeExtensionsJson } from "../src/vscode.js"

describe("VSCode helpers", () => {
  let testDir: string

  beforeEach(() => {
    testDir = join(tmpdir(), `herb-vscode-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    mkdirSync(testDir, { recursive: true })
  })

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
  })

  describe("getExtensionsJsonRelativePath", () => {
    test("returns correct relative path", () => {
      const relativePath = getExtensionsJsonRelativePath()

      expect(relativePath).toBe(".vscode/extensions.json")
    })
  })

  describe("addHerbExtensionRecommendation", () => {
    test("creates .vscode directory if it doesn't exist", () => {
      const vscodeDir = join(testDir, ".vscode")
      expect(existsSync(vscodeDir)).toBe(false)

      addHerbExtensionRecommendation(testDir)

      expect(existsSync(vscodeDir)).toBe(true)
    })

    test("creates extensions.json with Herb extension when file doesn't exist", () => {
      const extensionsPath = join(testDir, ".vscode", "extensions.json")
      expect(existsSync(extensionsPath)).toBe(false)

      const added = addHerbExtensionRecommendation(testDir)

      expect(added).toBe(true)
      expect(existsSync(extensionsPath)).toBe(true)

      const content = readFileSync(extensionsPath, "utf-8")
      const parsed: VSCodeExtensionsJson = JSON.parse(content)

      expect(parsed.recommendations).toEqual(["marcoroth.herb-lsp"])
    })

    test("adds Herb extension to existing recommendations", () => {
      const vscodeDir = join(testDir, ".vscode")
      const extensionsPath = join(vscodeDir, "extensions.json")

      mkdirSync(vscodeDir, { recursive: true })

      writeFileSync(
        extensionsPath,
        JSON.stringify({
          recommendations: ["dbaeumer.vscode-eslint", "esbenp.prettier-vscode"]
        })
      )

      const added = addHerbExtensionRecommendation(testDir)

      expect(added).toBe(true)

      const content = readFileSync(extensionsPath, "utf-8")
      const parsed: VSCodeExtensionsJson = JSON.parse(content)

      expect(parsed.recommendations).toEqual([
        "dbaeumer.vscode-eslint",
        "esbenp.prettier-vscode",
        "marcoroth.herb-lsp"
      ])
    })

    test("preserves other properties in extensions.json", () => {
      const vscodeDir = join(testDir, ".vscode")
      const extensionsPath = join(vscodeDir, "extensions.json")

      mkdirSync(vscodeDir, { recursive: true })
      writeFileSync(
        extensionsPath,
        JSON.stringify({
          recommendations: ["dbaeumer.vscode-eslint"],
          unwantedRecommendations: ["ms-vscode.vscode-typescript-tslint-plugin"]
        })
      )

      addHerbExtensionRecommendation(testDir)

      const content = readFileSync(extensionsPath, "utf-8")
      const parsed: VSCodeExtensionsJson = JSON.parse(content)

      expect(parsed.recommendations).toEqual([
        "dbaeumer.vscode-eslint",
        "marcoroth.herb-lsp"
      ])
      expect(parsed.unwantedRecommendations).toEqual([
        "ms-vscode.vscode-typescript-tslint-plugin"
      ])
    })

    test("does not add duplicate when Herb extension already recommended", () => {
      const vscodeDir = join(testDir, ".vscode")
      const extensionsPath = join(vscodeDir, "extensions.json")

      mkdirSync(vscodeDir, { recursive: true })
      writeFileSync(
        extensionsPath,
        JSON.stringify({
          recommendations: ["marcoroth.herb-lsp", "dbaeumer.vscode-eslint"]
        })
      )

      const added = addHerbExtensionRecommendation(testDir)

      expect(added).toBe(false)

      const content = readFileSync(extensionsPath, "utf-8")
      const parsed: VSCodeExtensionsJson = JSON.parse(content)

      expect(parsed.recommendations).toEqual([
        "marcoroth.herb-lsp",
        "dbaeumer.vscode-eslint"
      ])
    })

    test("handles empty recommendations array", () => {
      const vscodeDir = join(testDir, ".vscode")
      const extensionsPath = join(vscodeDir, "extensions.json")

      mkdirSync(vscodeDir, { recursive: true })
      writeFileSync(
        extensionsPath,
        JSON.stringify({
          recommendations: []
        })
      )

      const added = addHerbExtensionRecommendation(testDir)

      expect(added).toBe(true)

      const content = readFileSync(extensionsPath, "utf-8")
      const parsed: VSCodeExtensionsJson = JSON.parse(content)

      expect(parsed.recommendations).toEqual(["marcoroth.herb-lsp"])
    })

    test("handles missing recommendations property", () => {
      const vscodeDir = join(testDir, ".vscode")
      const extensionsPath = join(vscodeDir, "extensions.json")

      mkdirSync(vscodeDir, { recursive: true })
      writeFileSync(
        extensionsPath,
        JSON.stringify({
          unwantedRecommendations: ["some.extension"]
        })
      )

      const added = addHerbExtensionRecommendation(testDir)

      expect(added).toBe(true)

      const content = readFileSync(extensionsPath, "utf-8")
      const parsed: VSCodeExtensionsJson = JSON.parse(content)

      expect(parsed.recommendations).toEqual(["marcoroth.herb-lsp"])
      expect(parsed.unwantedRecommendations).toEqual(["some.extension"])
    })

    test("handles invalid JSON in extensions.json", () => {
      const vscodeDir = join(testDir, ".vscode")
      const extensionsPath = join(vscodeDir, "extensions.json")

      mkdirSync(vscodeDir, { recursive: true })
      writeFileSync(extensionsPath, "invalid json {]")

      const added = addHerbExtensionRecommendation(testDir)

      expect(added).toBe(true)

      const content = readFileSync(extensionsPath, "utf-8")
      const parsed: VSCodeExtensionsJson = JSON.parse(content)

      expect(parsed.recommendations).toEqual(["marcoroth.herb-lsp"])
    })

    test("formats JSON with proper indentation and newline", () => {
      addHerbExtensionRecommendation(testDir)

      const extensionsPath = join(testDir, ".vscode", "extensions.json")
      const content = readFileSync(extensionsPath, "utf-8")

      expect(content).toContain('{\n  "recommendations"')
      expect(content.endsWith("\n")).toBe(true)
    })
  })
})
