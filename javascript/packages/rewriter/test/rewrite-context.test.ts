import { describe, test, expect } from "vitest"
import { ASTRewriter } from "@herb-tools/rewriter"

import type { Node } from "@herb-tools/core"
import type { RewriteContext } from "@herb-tools/rewriter"

describe("RewriteContext", () => {
  test("supports custom properties", () => {
    class TestPreRewriter extends ASTRewriter {
      get name() { return "test" }
      get description() { return "Test" }

      rewrite<T extends Node>(node: T, context: RewriteContext): T {
        expect(context.baseDir).toBeDefined()

        const customContext = {
          ...context,
          customProp: "value"
        }

        expect(customContext.customProp).toBe("value")
        return node
      }
    }

    const rewriter = new TestPreRewriter()
    const mockNode = {} as Node

    rewriter.rewrite(mockNode, { baseDir: "/test" })
  })

  test("filePath is optional", () => {
    class TestPreRewriter extends ASTRewriter {
      get name() { return "test" }
      get description() { return "Test" }

      rewrite<T extends Node>(node: T, context: RewriteContext): T {
        expect(context.filePath === undefined || typeof context.filePath === "string").toBe(true)
        return node
      }
    }

    const rewriter = new TestPreRewriter()
    const mockNode = {} as Node

    rewriter.rewrite(mockNode, { baseDir: "/test" })
    rewriter.rewrite(mockNode, { baseDir: "/test", filePath: "/test/file.html.erb" })
  })
})
