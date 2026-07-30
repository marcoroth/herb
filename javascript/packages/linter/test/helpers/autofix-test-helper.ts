import { expect } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../../src/linter.js"

import type { RuleClass } from "../../src/types.js"

export interface AutofixExpectation {
  fixed?: number
  unfixed?: number
  includeUnsafe?: boolean
  fileName?: string
  indentWidth?: number
}

/**
 * Runs autofix through both the JavaScript and Rust backends, asserts they
 * produce the same corrected source and the same fixed/unfixed counts, and
 * returns the JavaScript result so callers can assert on it as usual.
 */
export function autofix(
  rules: RuleClass | RuleClass[],
  input: string,
  expectation: AutofixExpectation = {},
) {
  const ruleClasses = Array.isArray(rules) ? rules : [rules]
  const includeUnsafe = expectation.includeUnsafe ?? false

  const run = (mode: "javascript" | "rust") => {
    const linter = new Linter(Herb, ruleClasses)
    linter.backendMode = mode

    const context =
      expectation.fileName !== undefined || expectation.indentWidth !== undefined
        ? { ...(expectation.fileName !== undefined && { fileName: expectation.fileName }), ...(expectation.indentWidth !== undefined && { indentWidth: expectation.indentWidth }) }
        : undefined

    return linter.autofix(input, context, undefined, { includeUnsafe })
  }

  const javascript = run("javascript")
  const rust = run("rust")

  const ruleName = ruleClasses[0].ruleName

  if (rust.fixed.length === 0 && javascript.fixed.length > 0) {
    throw new Error(
      `Rust applied no autofix for "${ruleName}" while JavaScript fixed ${javascript.fixed.length}.\n\n` +
      `Input:\n${input}`
    )
  }

  expect(rust.source, `Rust autofix produced different source than JavaScript`).toBe(javascript.source)
  expect(rust.fixed.length, `Rust fixed count differs from JavaScript`).toBe(javascript.fixed.length)
  expect(rust.unfixed.length, `Rust unfixed count differs from JavaScript`).toBe(javascript.unfixed.length)

  return javascript
}

export function expectAutofix(
  rules: RuleClass | RuleClass[],
  input: string,
  expected: string,
  expectation: AutofixExpectation = {},
) {
  const result = autofix(rules, input, expectation)

  expect(result.source).toBe(expected)

  if (expectation.fixed !== undefined) {
    expect(result.fixed).toHaveLength(expectation.fixed)
  }

  if (expectation.unfixed !== undefined) {
    expect(result.unfixed).toHaveLength(expectation.unfixed)
  }
}

/**
 * Like `autofix`, but applies fixes that are marked unsafe, matching
 * `--fix-unsafe` rather than the safe-by-default `--fix`.
 */
export function unsafeAutofix(
  rules: RuleClass | RuleClass[],
  input: string,
  expectation: AutofixExpectation = {},
) {
  return autofix(rules, input, { ...expectation, includeUnsafe: true })
}

/**
 * Like `expectAutofix`, but applies fixes that are marked unsafe, matching
 * `--fix-unsafe` rather than the safe-by-default `--fix`.
 */
export function expectUnsafeAutofix(
  rules: RuleClass | RuleClass[],
  input: string,
  expected: string,
  expectation: AutofixExpectation = {},
) {
  expectAutofix(rules, input, expected, { ...expectation, includeUnsafe: true })
}

/**
 * Binds a rule (or rules) so autofix tests for it read without repeating the
 * rule at every call site, mirroring `createLinterTest` for offenses.
 */
export function createAutofixTest(rules: RuleClass | RuleClass[]) {
  return {
    autofix: (input: string, expectation?: AutofixExpectation) => autofix(rules, input, expectation),

    unsafeAutofix: (input: string, expectation?: AutofixExpectation) => unsafeAutofix(rules, input, expectation),

    expectAutofix: (input: string, expected: string, expectation?: AutofixExpectation) => expectAutofix(rules, input, expected, expectation),

    expectUnsafeAutofix: (input: string, expected: string, expectation?: AutofixExpectation) =>
      expectUnsafeAutofix(rules, input, expected, expectation),
  }
}
