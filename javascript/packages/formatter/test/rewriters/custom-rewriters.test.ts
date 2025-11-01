import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Formatter } from "../../src/formatter"

describe("Formatter with Rewriters Integration", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  describe("Custom Rewriters", () => {
    test("loads custom rewriter from fixtures directory", async () => {
      const formatter = new Formatter(Herb, { indentWidth: 2 })

      const info = await formatter.loadRewriters({
        baseDir: process.cwd(),
        patterns: ["test/rewriters/fixtures/**/*.js"],
        pre: ["uppercase-tags"],
        post: []
      })

      expect(info.preCount).toBe(1)
      expect(info.postCount).toBe(0)
      expect(info.warnings).toEqual([])
    })

    test("formats with custom rewriter", async () => {
      const formatter = new Formatter(Herb, { indentWidth: 2 })

      await formatter.loadRewriters({
        baseDir: process.cwd(),
        patterns: ["test/rewriters/fixtures/**/*.js"],
        pre: ["uppercase-tags"]
      })

      const source = `<div><span>Hello</span></div>`
      const result = formatter.format(source)

      expect(result).toBe(`<DIV><SPAN>Hello</SPAN></DIV>`)
    })

    test("combines custom rewriter with built-in Tailwind sorter", async () => {
      const formatter = new Formatter(Herb, { indentWidth: 2, maxLineLength: 80 })

      const info = await formatter.loadRewriters({
        baseDir: process.cwd(),
        patterns: ["test/rewriters/fixtures/**/*.js"],
        pre: ["tailwind-class-sorter", "uppercase-tags"]
      })

      expect(info.preCount).toBe(2)
      expect(info.warnings).toEqual([])

      const source = `<div class="px-4 bg-blue-500 text-white"><span>Hello</span></div>`
      const result = formatter.format(source)

      expect(result).toBe(`<DIV class="bg-blue-500 px-4 text-white"><SPAN>Hello</SPAN></DIV>`)
    })

    test("custom rewriter overrides built-in with same name", async () => {
      const formatter = new Formatter(Herb, { indentWidth: 2 })

      const info = await formatter.loadRewriters({
        baseDir: process.cwd(),
        patterns: ["test/rewriters/fixtures/**/*.js"],
        pre: ["uppercase-tags"]
      })

      expect(info.warnings.length).toBe(0)
      expect(info.preCount).toBe(1)
    })

    test("warns when custom rewriter not found", async () => {
      const formatter = new Formatter(Herb, { indentWidth: 2 })

      const info = await formatter.loadRewriters({
        baseDir: process.cwd(),
        patterns: ["test/rewriters/fixtures/**/*.js"],
        pre: ["non-existent-custom-rewriter"]
      })

      expect(info.preCount).toBe(0)
      expect(info.warnings.length).toBeGreaterThan(0)
      expect(info.warnings[0]).toBe(`Pre-format rewriter "non-existent-custom-rewriter" not found. Skipping.`)
    })

    test("loadCustomRewriters: false skips custom rewriters", async () => {
      const formatter = new Formatter(Herb, { indentWidth: 2 })

      const info = await formatter.loadRewriters({
        baseDir: process.cwd(),
        patterns: ["test/rewriters/fixtures/**/*.js"],
        pre: ["uppercase-tags"],
        loadCustomRewriters: false
      })

      expect(info.preCount).toBe(0)
      expect(info.warnings.length).toBeGreaterThan(0)
      expect(info.warnings[0]).toBe(`Pre-format rewriter "uppercase-tags" not found. Skipping.`)
    })
  })
})
