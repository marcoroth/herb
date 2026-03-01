import { describe, test, expect } from "vitest"
import { StringRewriter } from "@herb-tools/rewriter"

import type { RewriteContext } from "@herb-tools/rewriter"

describe("StringRewriter", () => {
  test("can be extended", () => {
    class TestPostRewriter extends StringRewriter {
      get name() { return "test-post" }
      get description() { return "Test post-format rewriter" }

      rewrite(formatted: string, _context: RewriteContext): string {
        return formatted
      }
    }

    const rewriter = new TestPostRewriter()

    expect(rewriter.name).toBe("test-post")
    expect(rewriter.description).toBe("Test post-format rewriter")
  })

  test("has default initialize implementation", async () => {
    class TestPostRewriter extends StringRewriter {
      get name() { return "test" }
      get description() { return "Test" }

      rewrite(formatted: string): string {
        return formatted
      }
    }

    const rewriter = new TestPostRewriter()

    await expect(rewriter.initialize({ baseDir: "/" })).resolves.not.toThrow()
  })

  test("can transform formatted string", () => {
    class AddTrailingNewline extends StringRewriter {
      get name() { return "add-newline" }
      get description() { return "Adds trailing newline" }

      rewrite(formatted: string): string {
        return formatted.endsWith("\n") ? formatted : formatted + "\n"
      }
    }

    const rewriter = new AddTrailingNewline()

    expect(rewriter.rewrite("test")).toBe("test\n")
    expect(rewriter.rewrite("test\n")).toBe("test\n")
  })

  test("can access context in rewrite", () => {
    class TestPostRewriter extends StringRewriter {
      get name() { return "test" }
      get description() { return "Test" }

      rewrite(formatted: string, context: RewriteContext): string {
        expect(context).toBeDefined()
        expect(context.baseDir).toBeDefined()
        return formatted
      }
    }

    const rewriter = new TestPostRewriter()
    const context = { baseDir: "/test" }

    rewriter.rewrite("test", context)
  })
})
