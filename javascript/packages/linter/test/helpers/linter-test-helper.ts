import { beforeAll, afterEach, expect } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../../src/linter.js"

import type { RuleClass } from "../../src/types.js"

interface ExpectedLocation {
  line?: number
  column?: number
}

type LocationInput = ExpectedLocation | [number, number] | [number]

interface ExpectedOffense {
  message: string
  location?: ExpectedLocation
}

interface LinterTestHelpers {
  expectNoOffenses: (html: string, context?: any) => void
  expectWarning: (message: string, location?: LocationInput) => void
  expectError: (message: string, location?: LocationInput) => void
  assertOffenses: (html: string, context?: any) => void
}

/**
 * Creates a test helper for linter rules that reduces boilerplate in tests.
 *
 * @param ruleClass - The rule class to test
 * @returns Object with helper functions for testing
 *
 * @example
 * ```ts
 * const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(MyRule)
 *
 * test("valid case", () => {
 *   expectNoOffenses(`<%= title %>`)
 * })
 *
 * test("invalid case", () => {
 *   expectError("Error message", { line: 1, column: 1 })
 *   // or use array syntax
 *   expectError("Error message", [1, 1])
 *
 *   assertOffenses(`<% %>`)
 * })
 * ```
 */
export function createLinterTest(ruleClass: RuleClass): LinterTestHelpers {
  const expectedWarnings: ExpectedOffense[] = []
  const expectedErrors: ExpectedOffense[] = []
  let hasAsserted = false

  beforeAll(async () => {
    await Herb.load()
  })

  afterEach(() => {
    if (!hasAsserted && (expectedWarnings.length > 0 || expectedErrors.length > 0)) {
      const pendingCount = expectedWarnings.length + expectedErrors.length
      throw new Error(
        `Test has ${pendingCount} pending expectation(s) that were never asserted. ` +
        `Did you forget to call assertOffenses() or expectNoOffenses()?`
      )
    }

    expectedWarnings.length = 0
    expectedErrors.length = 0
    hasAsserted = false
  })

  const expectNoOffenses = (html: string, context?: any) => {
    if (expectedWarnings.length > 0 || expectedErrors.length > 0) {
      throw new Error(
        "Cannot call expectNoOffenses() after registering expectations with expectWarning() or expectError()"
      )
    }

    hasAsserted = true
    const linter = new Linter(Herb, [ruleClass])
    const lintResult = linter.lint(html, context)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(0)
  }

  const normalizeLocation = (location?: LocationInput): ExpectedLocation | undefined => {
    if (!location) return undefined
    if (Array.isArray(location)) {
      return location.length === 2
        ? { line: location[0], column: location[1] }
        : { line: location[0] }
    }
    return location
  }

  const expectWarning = (message: string, location?: LocationInput) => {
    expectedWarnings.push({ message, location: normalizeLocation(location) })
  }

  const expectError = (message: string, location?: LocationInput) => {
    expectedErrors.push({ message, location: normalizeLocation(location) })
  }

  const assertOffenses = (html: string, context?: any) => {
    if (expectedWarnings.length === 0 && expectedErrors.length === 0) {
      throw new Error(
        "Cannot call assertOffenses() with no expectations. Use expectNoOffenses() instead."
      )
    }

    hasAsserted = true
    const linter = new Linter(Herb, [ruleClass])
    const lintResult = linter.lint(html, context)

    const ruleInstance = new ruleClass()
    const ruleName = ruleInstance.name

    if (lintResult.errors !== expectedErrors.length) {
      throw new Error(
        `Expected ${expectedErrors.length} error(s) but found ${lintResult.errors}.\n` +
        `Expected:\n${expectedErrors.map(e => `  - "${e.message}"`).join('\n')}\n` +
        `Actual:\n${lintResult.offenses.filter(o => o.severity === 'error').map(o => `  - "${o.message}" at ${o.location.start.line}:${o.location.start.column}`).join('\n')}`
      )
    }

    if (lintResult.warnings !== expectedWarnings.length) {
      throw new Error(
        `Expected ${expectedWarnings.length} warning(s) but found ${lintResult.warnings}.\n` +
        `Expected:\n${expectedWarnings.map(w => `  - "${w.message}"`).join('\n')}\n` +
        `Actual:\n${lintResult.offenses.filter(o => o.severity === 'warning').map(o => `  - "${o.message}" at ${o.location.start.line}:${o.location.start.column}`).join('\n')}`
      )
    }

    lintResult.offenses.forEach(offense => {
      expect(offense.rule).toBe(ruleName)
    })

    const actualErrors = lintResult.offenses.filter(o => o.severity === "error")
    const actualWarnings = lintResult.offenses.filter(o => o.severity === "warning")

    matchOffenses(expectedErrors, actualErrors, "error")
    matchOffenses(expectedWarnings, actualWarnings, "warning")

    expectedWarnings.length = 0
    expectedErrors.length = 0
  }

  return {
    expectNoOffenses,
    expectWarning,
    expectError,
    assertOffenses
  }
}

/**
 * Matches expected offenses to actual offenses in an order-independent way
 */
function matchOffenses(
  expected: ExpectedOffense[],
  actual: any[],
  severity: "error" | "warning"
) {
  const unmatched = [...expected]
  const unmatchedActual = [...actual]

  for (const actualOffense of actual) {
    const matchIndex = unmatched.findIndex(exp => {
      if (exp.message !== actualOffense.message) {
        return false
      }

      if (exp.location?.line !== undefined && exp.location.line !== actualOffense.location.start.line) {
        return false
      }

      if (exp.location?.column !== undefined && exp.location.column !== actualOffense.location.start.column) {
        return false
      }

      return true
    })

    if (matchIndex !== -1) {
      unmatched.splice(matchIndex, 1)
      const actualIndex = unmatchedActual.findIndex(o => o === actualOffense)
      if (actualIndex !== -1) {
        unmatchedActual.splice(actualIndex, 1)
      }
    }
  }

  if (unmatched.length > 0 || unmatchedActual.length > 0) {
    const errors: string[] = []

    if (unmatched.length > 0) {
      errors.push(`Expected ${severity}(s) not found:`)
      unmatched.forEach(exp => {
        const location = exp.location?.line !== undefined
          ? exp.location?.column !== undefined
            ? ` at ${exp.location.line}:${exp.location.column}`
            : ` at line ${exp.location.line}`
          : ""
        errors.push(`  - "${exp.message}"${location}`)
      })
    }

    if (unmatchedActual.length > 0) {
      errors.push(`Unexpected ${severity}(s) found:`)
      unmatchedActual.forEach(offense => {
        errors.push(
          `  - "${offense.message}" at ${offense.location.start.line}:${offense.location.start.column}`
        )
      })
    }

    throw new Error(errors.join("\n"))
  }
}
