import { describe, test, expect, beforeEach, afterEach } from "vitest"

import { CustomRewriterLoader } from "@herb-tools/rewriter/loader"
import { ASTRewriter } from "@herb-tools/rewriter"

import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "fs"
import { tmpdir } from "os"
import { join } from "path"

import type { ParseResult } from "@herb-tools/core"
import type { RewriteContext } from "@herb-tools/rewriter"

describe("CustomRewriterLoader", () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "herb-rewriter-test-"))
  })

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  test("creates loader with default options", () => {
    const loader = new CustomRewriterLoader()

    expect(loader).toBeDefined()
  })

  test("creates loader with custom base directory", () => {
    const loader = new CustomRewriterLoader({ baseDir: tempDir })

    expect(loader).toBeDefined()
  })

  test("discovers no rewriter files in empty directory", async () => {
    const loader = new CustomRewriterLoader({ baseDir: tempDir })
    const files = await loader.discoverRewriterFiles()

    expect(files).toEqual([])
  })

  test("discovers rewriter files with default pattern", async () => {
    const rewritersDir = join(tempDir, ".herb", "rewriters")
    mkdirSync(rewritersDir, { recursive: true })

    const rewriterPath = join(rewritersDir, "test-rewriter.mjs")

    writeFileSync(rewriterPath, `
      export default class TestRewriter {
        get name() { return "test" }
        get description() { return "Test rewriter" }
        async initialize() {}
        rewrite(result) { return result }
      }
    `)

    const loader = new CustomRewriterLoader({ baseDir: tempDir })
    const files = await loader.discoverRewriterFiles()

    expect(files.length).toBeGreaterThan(0)
    expect(files.some(f => f.includes("test-rewriter.mjs"))).toBe(true)
  })

  test("discovers rewriter files with custom pattern", async () => {
    const customDir = join(tempDir, "custom-rewriters")
    mkdirSync(customDir, { recursive: true })

    const rewriterPath = join(customDir, "my-rewriter.js")

    writeFileSync(rewriterPath, `
      export default class MyRewriter {
        get name() { return "my-rewriter" }
        get description() { return "My custom rewriter" }
        async initialize() {}
        rewrite(result) { return result }
      }
    `)

    const loader = new CustomRewriterLoader({
      baseDir: tempDir,
      patterns: ["custom-rewriters/**/*.js"]
    })

    const files = await loader.discoverRewriterFiles()

    expect(files.length).toBeGreaterThan(0)
    expect(files.some(f => f.includes("my-rewriter.js"))).toBe(true)
  })

  test("loads valid pre-format rewriter", async () => {
    const rewritersDir = join(tempDir, ".herb", "rewriters")
    mkdirSync(rewritersDir, { recursive: true })

    const rewriterPath = join(rewritersDir, "valid-pre.mjs")
    writeFileSync(rewriterPath, `
      export class TestPreRewriter {
        get name() { return "test-pre" }
        get description() { return "Test pre-format rewriter" }
        async initialize() {}
        rewrite(result) { return result }
      }

      Object.setPrototypeOf(TestPreRewriter.prototype, Object.getPrototypeOf({}))
    `)

    const loader = new CustomRewriterLoader({ baseDir: tempDir, silent: true })
    const rewriters = await loader.loadRewriters()

    expect(rewriters).toBeDefined()
  })

  test("handles errors gracefully with silent mode", async () => {
    const rewritersDir = join(tempDir, ".herb", "rewriters")
    mkdirSync(rewritersDir, { recursive: true })

    const rewriterPath = join(rewritersDir, "invalid.mjs")

    writeFileSync(rewriterPath, `
      export default "not a class"
    `)

    const loader = new CustomRewriterLoader({ baseDir: tempDir, silent: true })
    const rewriters = await loader.loadRewriters()

    expect(rewriters).toEqual([])
  })

  test("loadRewritersWithInfo returns detailed information", async () => {
    const rewritersDir = join(tempDir, ".herb", "rewriters")
    mkdirSync(rewritersDir, { recursive: true })

    const loader = new CustomRewriterLoader({ baseDir: tempDir })
    const { rewriters, rewriterInfo, duplicateWarnings } = await loader.loadRewritersWithInfo()

    expect(rewriters).toEqual([])
    expect(rewriterInfo).toEqual([])
    expect(duplicateWarnings).toEqual([])
  })

  test("detects duplicate rewriter names", async () => {
    const rewritersDir = join(tempDir, ".herb", "rewriters")
    mkdirSync(rewritersDir, { recursive: true })

    const loader = new CustomRewriterLoader({ baseDir: tempDir })
    const result = await loader.loadRewritersWithInfo()

    expect(result).toHaveProperty("duplicateWarnings")
  })

  test("static hasCustomRewriters returns false for empty directory", async () => {
    const hasRewriters = await CustomRewriterLoader.hasCustomRewriters(tempDir)

    expect(hasRewriters).toBe(false)
  })

  test("static loadAndMergeRewriters combines builtin and custom", async () => {
    class MockBuiltinRewriter extends ASTRewriter {
      get name() { return "mock-builtin" }
      get description() { return "Mock builtin rewriter" }
      rewrite(result: ParseResult, _context: RewriteContext): ParseResult {
        return result
      }
    }

    const merged = await CustomRewriterLoader.loadAndMergeRewriters(
      [MockBuiltinRewriter],
      { baseDir: tempDir, silent: true }
    )

    expect(merged.length).toBeGreaterThanOrEqual(1)
    expect(merged).toContain(MockBuiltinRewriter)
  })
})
