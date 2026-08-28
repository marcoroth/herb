import { readFileSync } from "fs"
import { join } from "path"

import { describe, test, expect } from "vitest"

import * as browserEntry from "../src/browser.js"
import * as nodeEntry from "../src/index.js"

const NODE_ONLY_EXPORTS = [
  "loadCustomTheme",
  "resolveThemeInput",
  "highlightFileFromPath",
  "highlightDiagnosticFromPath",
  "highlightContent",
  "highlightFile",
]

describe("browser entry point", () => {
  test("keeps the Node-only surface out", () => {
    for (const name of NODE_ONLY_EXPORTS) {
      expect(browserEntry).not.toHaveProperty(name)
      expect(nodeEntry).toHaveProperty(name)
    }
  })

  test("is fully re-listed by the Node entry", () => {
    const missing = Object.keys(browserEntry).filter(name => !(name in nodeEntry))

    expect(missing).toEqual([])
  })

  test("still exports everything a browser needs", () => {
    expect(browserEntry.Highlighter).toBeTypeOf("function")
    expect(browserEntry.SyntaxRenderer).toBeTypeOf("function")
    expect(browserEntry.ANSIConverter).toBeTypeOf("function")
    expect(browserEntry.HerbANSIElement).toBeTypeOf("function")
    expect(browserEntry.resolveTheme("onedark")).toEqual(browserEntry.themes.onedark)
  })

  test("points at the built bundle for a theme path instead of reading it", () => {
    expect(() => browserEntry.resolveTheme("./some-theme.json")).toThrow("loadCustomTheme")
  })

  test("bundles without a single Node built-in", () => {
    const bundle = readFileSync(join(__dirname, "../dist/browser.js"), "utf8")
    const imports = [...bundle.matchAll(/^import[^\n]*? from ["']([^"']+)["']/gm)].map(match => match[1])

    expect(imports.length).toBeGreaterThan(0)
    expect(imports).not.toContain("fs")
    expect(imports).not.toContain("path")
    expect(imports).not.toContain("@herb-tools/node-wasm")
    expect(imports.filter(id => id.startsWith("node:"))).toEqual([])
  })
})
