import { describe, test, expect } from "vitest"
import { ASTRewriter } from "@herb-tools/rewriter"

import type { ParseResult } from "@herb-tools/core"
import type { RewriteContext } from "@herb-tools/rewriter"

describe("RewriteContext", () => {
  test("supports custom properties", () => {
    class TestPreRewriter extends ASTRewriter {
      get name() { return "test" }
      get description() { return "Test" }

      rewrite(result: ParseResult, context: RewriteContext): ParseResult {
        expect(context.baseDir).toBeDefined()

        const customContext = {
          ...context,
          customProp: "value"
        }

        expect(customContext.customProp).toBe("value")
        return result
      }
    }

    const rewriter = new TestPreRewriter()
    const mockResult = { failed: false, value: {} } as ParseResult

    rewriter.rewrite(mockResult, { baseDir: "/test" })
  })

  test("filePath is optional", () => {
    class TestPreRewriter extends ASTRewriter {
      get name() { return "test" }
      get description() { return "Test" }

      rewrite(result: ParseResult, context: RewriteContext): ParseResult {
        expect(context.filePath === undefined || typeof context.filePath === "string").toBe(true)
        return result
      }
    }

    const rewriter = new TestPreRewriter()
    const mockResult = { failed: false, value: {} } as ParseResult

    rewriter.rewrite(mockResult, { baseDir: "/test" })
    rewriter.rewrite(mockResult, { baseDir: "/test", filePath: "/test/file.html.erb" })
  })
})
