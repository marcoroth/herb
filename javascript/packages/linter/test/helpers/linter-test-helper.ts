import { beforeAll, afterEach, expect } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../../src/linter.js"
import { ParseCache } from "../../src/parse-cache.js"
import { Config } from "@herb-tools/config"

import { ParserRule } from "../../src/types.js"
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

interface TestOptions {
  context?: any
  allowInvalidSyntax?: boolean
}

interface LinterTestHelpers {
  expectNoOffenses: (html: string, options?: any | TestOptions) => void
  expectWarning: (message: string, location?: LocationInput) => void
  expectError: (message: string, location?: LocationInput) => void
  assertOffenses: (html: string, options?: any | TestOptions) => void
}

/**
 * Creates a test helper for linter rules that reduces boilerplate in tests.
 *
 * @param rules - A single rule class or array of rule classes to test. When multiple rules are provided,
 *                the first rule is considered the primary rule being tested.
 * @returns Object with helper functions for testing
 *
 * @example
 * ```ts
 * // Single rule
 * const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(MyRule)
 *
 * // Multiple rules (e.g., for testing disable comments)
 * const { expectNoOffenses, expectError, assertOffenses } = createLinterTest([
 *   HerbDisableCommentUnnecessaryRule,
 *   HTMLTagNameLowercaseRule
 * ])
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
export function createLinterTest(rules: RuleClass | RuleClass[], configOverride?: Record<string, any>): LinterTestHelpers {
  const expectedWarnings: ExpectedOffense[] = []
  const expectedErrors: ExpectedOffense[] = []
  let hasAsserted = false

  const ruleClasses = Array.isArray(rules) ? rules : [rules]
  const primaryRuleClass = ruleClasses[0]
  const ruleInstance = new primaryRuleClass()
  const isParserNoErrorsRule = ruleInstance.name === "parser-no-errors"
  const ruleParserOptions = ruleInstance instanceof ParserRule ? ruleInstance.parserOptions : {}
  const parseCache = new ParseCache(Herb)
  const ruleConfigOverride = configOverride

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
    parseCache.clear()
  })

  const expectNoOffenses = (html: string, options?: any | TestOptions) => {
    if (expectedWarnings.length > 0 || expectedErrors.length > 0) {
      throw new Error(
        "Cannot call expectNoOffenses() after registering expectations with expectWarning() or expectError()"
      )
    }

    hasAsserted = true

    const context = options?.context ?? options
    const allowInvalidSyntax = options?.allowInvalidSyntax ?? false

    if (!isParserNoErrorsRule) {
      const parseResult = parseCache.get(html, ruleParserOptions)
      const parserErrors = parseResult.recursiveErrors()

      if (allowInvalidSyntax && parserErrors.length === 0) {
        throw new Error(
          `Test has 'allowInvalidSyntax: true' but the HTML is actually valid.\n` +
          `Remove the 'allowInvalidSyntax' option since the HTML parses without errors.\n` +
          `Source:\n${html}`
        )
      }

      if (!allowInvalidSyntax && parserErrors.length > 0) {
        const formattedErrors = parserErrors.map(error => `  - ${error.message} (${error.type}) at ${error.location.start.line}:${error.location.start.column}`).join('\n')

        throw new Error(
          `Test HTML has parser errors. Fix the HTML before testing the linter rule.\n` +
          `Source:\n${html}\n\n` +
          `Parser errors:\n${formattedErrors}`
        )
      }
    }

    const rulesConfig: Record<string, any> = {}

    ruleClasses.forEach(ruleClass => {
      const instance = new ruleClass()
      const isPrimary = instance.name === ruleInstance.name
      rulesConfig[instance.name] = isPrimary && ruleConfigOverride
        ? { ...instance.defaultConfig, ...ruleConfigOverride }
        : instance.defaultConfig
    })

    const config = Config.fromObject({
      linter: {
        rules: rulesConfig
      }
    })

    const linter = new Linter(Herb, ruleClasses, config)
    const lintResult = linter.lint(html, context)

    const ruleName = ruleInstance.name
    const primaryOffenses = lintResult.offenses.filter(offense => offense.rule === ruleName)

    expect(primaryOffenses).toHaveLength(0)
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

  const assertOffenses = (html: string, options?: any | TestOptions) => {
    if (expectedWarnings.length === 0 && expectedErrors.length === 0) {
      throw new Error(
        "Cannot call assertOffenses() with no expectations. Use expectNoOffenses() instead."
      )
    }

    hasAsserted = true

    const context = options?.context ?? options
    const allowInvalidSyntax = options?.allowInvalidSyntax ?? false

    if (!isParserNoErrorsRule) {
      const parseResult = parseCache.get(html, ruleParserOptions)
      const parserErrors = parseResult.recursiveErrors()

      if (allowInvalidSyntax && parserErrors.length === 0) {
        throw new Error(
          `Test has 'allowInvalidSyntax: true' but the HTML is actually valid.\n` +
          `Remove the 'allowInvalidSyntax' option since the HTML parses without errors.\n` +
          `Source:\n${html}`
        )
      }

      if (!allowInvalidSyntax && parserErrors.length > 0) {
        const formattedErrors = parserErrors.map(error => `  - ${error.message} (${error.type}) at ${error.location.start.line}:${error.location.start.column}`).join('\n')

        throw new Error(
          `Test HTML has parser errors. Fix the HTML before testing the linter rule.\n` +
          `Source:\n${html}\n\n` +
          `Parser errors:\n${formattedErrors}`
        )
      }
    }

    const rulesConfig: Record<string, any> = {}

    ruleClasses.forEach(ruleClass => {
      const instance = new ruleClass()
      const isPrimary = instance.name === ruleInstance.name
      rulesConfig[instance.name] = isPrimary && ruleConfigOverride
        ? { ...instance.defaultConfig, ...ruleConfigOverride }
        : instance.defaultConfig
    })

    const config = Config.fromObject({
      linter: {
        rules: rulesConfig
      }
    })

    const linter = new Linter(Herb, ruleClasses, config)
    const lintResult = linter.lint(html, context)
    const ruleName = ruleInstance.name

    const primaryOffenses = lintResult.offenses.filter(o => o.rule === ruleName)
    const primaryErrors = primaryOffenses.filter(o => o.severity === "error")
    const primaryWarnings = primaryOffenses.filter(o => o.severity === "warning")

    if (primaryErrors.length !== expectedErrors.length) {
      throw new Error(
        `Expected ${expectedErrors.length} error(s) from rule "${ruleName}" but found ${primaryErrors.length}.\n` +
        `Expected:\n${expectedErrors.map(e => `  - "${e.message}"`).join('\n')}\n` +
        `Actual:\n${primaryErrors.map(o => `  - "${o.message}" at ${o.location.start.line}:${o.location.start.column}`).join('\n')}`
      )
    }

    if (primaryWarnings.length !== expectedWarnings.length) {
      throw new Error(
        `Expected ${expectedWarnings.length} warning(s) from rule "${ruleName}" but found ${primaryWarnings.length}.\n` +
        `Expected:\n${expectedWarnings.map(w => `  - "${w.message}"`).join('\n')}\n` +
        `Actual:\n${primaryWarnings.map(o => `  - "${o.message}" at ${o.location.start.line}:${o.location.start.column}`).join('\n')}`
      )
    }

    primaryOffenses.forEach(offense => {
      expect(offense.rule).toBe(ruleName)
    })

    const actualErrors = primaryErrors
    const actualWarnings = primaryWarnings

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
