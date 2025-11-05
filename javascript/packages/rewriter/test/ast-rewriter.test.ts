import { describe, test, expect } from "vitest"
import { ASTRewriter } from "@herb-tools/rewriter"

import type { ParseResult } from "@herb-tools/core"
import type { RewriteContext } from "@herb-tools/rewriter"

describe("ASTRewriter", () => {
  test("can be extended", () => {
    class TestPreRewriter extends ASTRewriter {
      get name() { return "test-pre" }
      get description() { return "Test pre-format rewriter" }

      rewrite(result: ParseResult, _context: RewriteContext): ParseResult {
        return result
      }
    }

    const rewriter = new TestPreRewriter()

    expect(rewriter.name).toBe("test-pre")
    expect(rewriter.description).toBe("Test pre-format rewriter")
  })

  test("has default initialize implementation", async () => {
    class TestPreRewriter extends ASTRewriter {
      get name() { return "test" }
      get description() { return "Test" }

      rewrite(result: ParseResult): ParseResult {
        return result
      }
    }

    const rewriter = new TestPreRewriter()

    await expect(rewriter.initialize({ baseDir: "/" })).resolves.not.toThrow()
  })

  test("rewrite method is abstract and must be implemented", () => {
    class TestPreRewriter extends ASTRewriter {
      get name() { return "test" }
      get description() { return "Test" }

      rewrite(result: ParseResult): ParseResult {
        return result
      }
    }

    const rewriter = new TestPreRewriter()

    expect(typeof rewriter.rewrite).toBe("function")
  })

  test("can access context in rewrite", () => {
    class TestPreRewriter extends ASTRewriter {
      get name() { return "test" }
      get description() { return "Test" }

      rewrite(result: ParseResult, context: RewriteContext): ParseResult {
        expect(context).toBeDefined()
        expect(context.baseDir).toBeDefined()
        return result
      }
    }

    const rewriter = new TestPreRewriter()
    const mockResult = { failed: false, value: {} } as ParseResult
    const context = { baseDir: "/test" }

    rewriter.rewrite(mockResult, context)
  })
})
