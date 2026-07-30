import { expect } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../../src/linter.js"

import type { RuleClass } from "../../src/types.js"

export interface AutofixExpectation {
  fixed?: number
  unfixed?: number
  includeUnsafe?: boolean
  fileName?: string
}

/**
 * Runs autofix through both the JavaScript and Rust backends and asserts they
 * produce the same corrected source and the same fixed/unfixed counts.
 *
 * Rust rules that have no autofix yet report everything as unfixed, so the
 * comparison is skipped for those until they are ported.
 */
export function expectAutofix(
  rules: RuleClass | RuleClass[],
  input: string,
  expected: string,
  expectation: AutofixExpectation = {},
) {
  const ruleClasses = Array.isArray(rules) ? rules : [rules]
  const includeUnsafe = expectation.includeUnsafe ?? false

  const run = (mode: "javascript" | "rust") => {
    const linter = new Linter(Herb, ruleClasses)
    linter.backendMode = mode

    const context = expectation.fileName ? { fileName: expectation.fileName } : undefined

    return linter.autofix(input, context, undefined, { includeUnsafe })
  }

  const javascript = run("javascript")

  expect(javascript.source).toBe(expected)

  if (expectation.fixed !== undefined) {
    expect(javascript.fixed).toHaveLength(expectation.fixed)
  }

  if (expectation.unfixed !== undefined) {
    expect(javascript.unfixed).toHaveLength(expectation.unfixed)
  }

  const rust = run("rust")

  if (rust.fixed.length === 0 && javascript.fixed.length > 0) {
    // rule not yet autofixable in Rust
    return
  }

  expect(rust.source, `Rust autofix produced different source than JavaScript`).toBe(javascript.source)
  expect(rust.fixed.length, `Rust fixed count differs from JavaScript`).toBe(javascript.fixed.length)
  expect(rust.unfixed.length, `Rust unfixed count differs from JavaScript`).toBe(javascript.unfixed.length)
}
