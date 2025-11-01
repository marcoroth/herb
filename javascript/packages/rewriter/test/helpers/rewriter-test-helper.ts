import { beforeAll, expect } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { IdentityPrinter } from "@herb-tools/printer"

import type { ASTRewriter, RewriteContext } from "../../src/index.js"
import type { ParseResult } from "@herb-tools/core"

interface RewriterTestOptions {
  context?: RewriteContext
}

interface RewriterTestHelpers {
  expectTransform: (input: string, expected: string, options?: RewriterTestOptions) => Promise<ParseResult>
  expectNoTransform: (input: string, options?: RewriterTestOptions) => Promise<ParseResult>
}

/**
 * Creates a test helper for rewriters that reduces boilerplate in tests.
 *
 * @param RewriterClass - The rewriter class to test
 * @returns Object with helper functions for testing
 */
export function createRewriterTest(
  RewriterClass: new () => ASTRewriter
): RewriterTestHelpers {
  let rewriter: ASTRewriter

  beforeAll(async () => {
    await Herb.load()
    rewriter = new RewriterClass()
    await rewriter.initialize({ baseDir: process.cwd() })
  })

  const expectTransform = async (
    input: string,
    expected: string,
    options?: RewriterTestOptions
  ): Promise<ParseResult> => {
    const context = options?.context ?? { baseDir: process.cwd() }

    const parseResult = Herb.parse(input, { track_whitespace: true })

    if (parseResult.failed) {
      throw new Error(
        `Test input has parser errors. Fix the HTML before testing the rewriter.\n` +
        `Input:\n${input}\n\n` +
        `Parser errors:\n${parseResult.recursiveErrors().map(e => `  - ${e.message}`).join('\n')}`
      )
    }

    const rewritten = rewriter.rewrite(parseResult, context)

    if (rewritten.failed) {
      throw new Error(
        `Rewriter failed to process input.\n` +
        `Input:\n${input}\n\n` +
        `Errors:\n${rewritten.recursiveErrors().map(e => `  - ${e.message}`).join('\n')}`
      )
    }

    const output = IdentityPrinter.print(rewritten.value)

    expect(output).toBe(expected)

    return rewritten
  }

  const expectNoTransform = async (
    input: string,
    options?: RewriterTestOptions
  ): Promise<ParseResult> => {
    return await expectTransform(input, input, options)
  }

  return {
    expectTransform,
    expectNoTransform
  }
}
