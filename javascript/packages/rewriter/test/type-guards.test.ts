import { describe, test, expect } from "vitest"
import { ASTRewriter, StringRewriter, isASTRewriterClass, isStringRewriterClass, isRewriterClass } from "@herb-tools/rewriter"

import type { ParseResult } from "@herb-tools/core"

describe("Type Guards", () => {
  test("isASTRewriterClass identifies PreFormatRewriter classes", () => {
    class TestPreRewriter extends ASTRewriter {
      get name() { return "test" }
      get description() { return "Test" }

      rewrite(result: ParseResult): ParseResult {
        return result
      }
    }

    expect(isASTRewriterClass(TestPreRewriter)).toBe(true)
    expect(isASTRewriterClass(class {})).toBe(false)
    expect(isASTRewriterClass("not a class")).toBe(false)
    expect(isASTRewriterClass(null)).toBe(false)
  })

  test("isStringRewriterClass identifies PostFormatRewriter classes", () => {
    class TestPostRewriter extends StringRewriter {
      get name() { return "test" }
      get description() { return "Test" }

      rewrite(formatted: string): string {
        return formatted
      }
    }

    expect(isStringRewriterClass(TestPostRewriter)).toBe(true)
    expect(isStringRewriterClass(class {})).toBe(false)
    expect(isStringRewriterClass("not a class")).toBe(false)
    expect(isStringRewriterClass(null)).toBe(false)
  })

  test("isRewriterClass identifies any rewriter class", () => {
    class TestPreRewriter extends ASTRewriter {
      get name() { return "test" }
      get description() { return "Test" }

      rewrite(result: ParseResult): ParseResult {
        return result
      }
    }

    class TestPostRewriter extends StringRewriter {
      get name() { return "test" }
      get description() { return "Test" }

      rewrite(formatted: string): string {
        return formatted
      }
    }

    expect(isRewriterClass(TestPreRewriter)).toBe(true)
    expect(isRewriterClass(TestPostRewriter)).toBe(true)
    expect(isRewriterClass(class {})).toBe(false)
  })

  test("type guards return false for non-function values", () => {
    expect(isASTRewriterClass(123)).toBe(false)
    expect(isStringRewriterClass({})).toBe(false)
    expect(isRewriterClass(undefined)).toBe(false)
  })
})
