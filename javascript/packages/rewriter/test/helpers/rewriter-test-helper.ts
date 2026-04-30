import { beforeAll, expect } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { IdentityPrinter } from "@herb-tools/printer"

import { ASTRewriter } from "../../src/ast-rewriter.js"
import { StringRewriter } from "../../src/string-rewriter.js"

import type { RewriteContext } from "../../src/index.js"
import type { Node } from "@herb-tools/core"
import type { ParseOptions } from "@herb-tools/core"

interface RewriterTestOptions {
  context?: RewriteContext
  parseOptions?: Partial<ParseOptions>
}

interface RewriterTestHelpers {
  expectTransform: (input: string, expected: string, options?: RewriterTestOptions) => Promise<Node | string>
  expectNoTransform: (input: string, options?: RewriterTestOptions) => Promise<Node | string>
}

/**
 * Creates a test helper for rewriters that reduces boilerplate in tests.
 *
 * Supports both ASTRewriter (parses input and rewrites the AST) and
 * StringRewriter (passes the input string directly to the rewriter).
 *
 * @param RewriterClass - The rewriter class to test
 * @returns Object with helper functions for testing
 */
export function createRewriterTest(
  RewriterClass: new () => ASTRewriter | StringRewriter
): RewriterTestHelpers {
  let rewriter: ASTRewriter | StringRewriter

  beforeAll(async () => {
    await Herb.load()
    rewriter = new RewriterClass()
    await rewriter.initialize({ baseDir: process.cwd() })
  })

  const expectTransform = async (
    input: string,
    expected: string,
    options?: RewriterTestOptions
  ): Promise<Node | string> => {
    const context = options?.context ?? { baseDir: process.cwd() }

    if (rewriter instanceof StringRewriter) {
      const output = rewriter.rewrite(input, context)

      expect(output).toBe(expected)

      return output
    }

    const parseResult = Herb.parse(input, { track_whitespace: true, ...options?.parseOptions })

    if (parseResult.failed) {
      throw new Error(
        `Test input has parser errors. Fix the HTML before testing the rewriter.\n` +
        `Input:\n${input}\n\n` +
        `Parser errors:\n${parseResult.recursiveErrors().map(e => `  - ${e.message}`).join('\n')}`
      )
    }

    const node = (rewriter as ASTRewriter).rewrite(parseResult.value, context)
    const output = IdentityPrinter.print(node)

    expect(output).toBe(expected)

    return node
  }

  const expectNoTransform = async (
    input: string,
    options?: RewriterTestOptions
  ): Promise<Node | string> => {
    return await expectTransform(input, input, options)
  }

  return {
    expectTransform,
    expectNoTransform
  }
}
