import { beforeAll, afterEach, expect } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../../src/linter.js"
import { rules as allBuiltinRules } from "../../src/rules.js"
import { normalizeOffenses } from "../../src/backend-comparison.js"
import { ParseCache } from "../../src/parse-cache.js"
import { Config } from "@herb-tools/config"

import { ParserRule } from "../../src/types.js"
import type { HerbBackend } from "@herb-tools/core"
import type { RuleClass, LintResult } from "../../src/types.js"
import type { BackendMode } from "../../src/linter.js"

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
  expectInfo: (message: string, location?: LocationInput) => void
  expectHint: (message: string, location?: LocationInput) => void
  assertOffenses: (html: string, options?: any | TestOptions) => void
}

export interface LinterTestOptions {
  configOverride?: Record<string, any>
  herb?: HerbBackend
}

/**
 * Creates a test helper for linter rules that reduces boilerplate in tests.
 *
 * Each assertion automatically runs both the JavaScript and Rust linting paths
 * and fails if the results differ. This ensures all rules are implemented in
 * both backends.
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
export function createLinterTest(rules: RuleClass | RuleClass[], configOverrideOrOptions?: Record<string, any> | LinterTestOptions): LinterTestHelpers {
  const isOptionsObject = configOverrideOrOptions && ("herb" in configOverrideOrOptions || "configOverride" in configOverrideOrOptions)
  const options: LinterTestOptions = isOptionsObject ? configOverrideOrOptions as LinterTestOptions : { configOverride: configOverrideOrOptions as Record<string, any> | undefined }

  const testHerb = options.herb ?? Herb
  const expectedWarnings: ExpectedOffense[] = []
  const expectedErrors: ExpectedOffense[] = []
  const expectedInfos: ExpectedOffense[] = []
  const expectedHints: ExpectedOffense[] = []
  let hasAsserted = false

  const ruleClasses = Array.isArray(rules) ? rules : [rules]
  const primaryRuleClass = ruleClasses[0]
  const ruleInstance = new primaryRuleClass()
  const isParserNoErrorsRule = primaryRuleClass.ruleName === "parser-no-errors" || ('consumesParserErrors' in primaryRuleClass && primaryRuleClass.consumesParserErrors)
  const ruleParserOptions = ruleInstance instanceof ParserRule ? ruleInstance.parserOptions : {}
  const parseCache = new ParseCache(Herb)
  const ruleConfigOverride = options.configOverride

  beforeAll(async () => {
    await testHerb.load()
  })

  afterEach(() => {
    if (!hasAsserted && (expectedWarnings.length > 0 || expectedErrors.length > 0 || expectedInfos.length > 0 || expectedHints.length > 0)) {
      const pendingCount = expectedWarnings.length + expectedErrors.length + expectedInfos.length + expectedHints.length

      throw new Error(
        `Test has ${pendingCount} pending expectation(s) that were never asserted. ` +
        `Did you forget to call assertOffenses() or expectNoOffenses()?`
      )
    }

    expectedWarnings.length = 0
    expectedErrors.length = 0
    expectedInfos.length = 0
    expectedHints.length = 0
    hasAsserted = false
    parseCache.clear()
  })

  const buildConfig = () => {
    const rulesConfig: Record<string, any> = {}

    ruleClasses.forEach(ruleClass => {
      const instance = new ruleClass()
      const isPrimary = instance.name === ruleInstance.name
      rulesConfig[instance.name] = isPrimary ? { ...instance.defaultConfig, enabled: true, ...ruleConfigOverride } : instance.defaultConfig
    })

    return Config.fromObject({
      linter: {
        rules: rulesConfig
      }
    })
  }

  const createLinterWithMode = (config: ReturnType<typeof buildConfig>, mode: BackendMode) => {
    const linter = new Linter(testHerb, ruleClasses, config, allBuiltinRules)
    linter.backendMode = mode
    return linter
  }

  const lintWithMode = (html: string, config: ReturnType<typeof buildConfig>, mode: BackendMode, context?: any): LintResult => {
    const linter = createLinterWithMode(config, mode)
    return linter.lint(html, context)
  }

  const compareBackendResults = (resultA: LintResult, resultB: LintResult, labelA: string, labelB: string, ruleName: string, html: string) => {
    const offensesA = resultA.offenses.filter(o => o.rule === ruleName)
    const offensesB = resultB.offenses.filter(o => o.rule === ruleName)

    const normalizedA = normalizeOffenses(offensesA)
    const normalizedB = normalizeOffenses(offensesB)

    if (JSON.stringify(normalizedA) !== JSON.stringify(normalizedB)) {
      const formatOffenses = (offenses: typeof normalizedA) =>
        offenses.length === 0
          ? "  (none)"
          : offenses.map(o => `  - [${o.severity}] "${o.message}" at ${o.line}:${o.column}`).join("\n")

      throw new Error(
        `Backend mismatch for rule "${ruleName}"!\n\n` +
        `${labelA} (${offensesA.length} offense(s)):\n${formatOffenses(normalizedA)}\n\n` +
        `${labelB} (${offensesB.length} offense(s)):\n${formatOffenses(normalizedB)}\n\n` +
        `Source:\n${html}`
      )
    }
  }

  const validateParserErrors = (html: string, allowInvalidSyntax: boolean) => {
    if (isParserNoErrorsRule) return

    const parseResult = testHerb.parse(html, { track_whitespace: true })
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

  const expectNoOffenses = (html: string, options?: any | TestOptions) => {
    if (expectedWarnings.length > 0 || expectedErrors.length > 0 || expectedInfos.length > 0 || expectedHints.length > 0) {
      throw new Error(
        "Cannot call expectNoOffenses() after registering expectations with expectWarning(), expectError(), or expectInfo()"
      )
    }

    hasAsserted = true

    const context = options?.context ?? options
    const allowInvalidSyntax = options?.allowInvalidSyntax ?? false

    validateParserErrors(html, allowInvalidSyntax)

    const config = buildConfig()
    const ruleName = primaryRuleClass.ruleName

    const javascriptResult = lintWithMode(html, config, "javascript", context)
    const jsPrimaryOffenses = javascriptResult.offenses.filter(offense => offense.rule === ruleName)
    expect(jsPrimaryOffenses).toHaveLength(0)

    const rustResult = lintWithMode(html, config, "rust", context)
    compareBackendResults(javascriptResult, rustResult, "JavaScript", "Rust", ruleName, html)
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

  const expectInfo = (message: string, location?: LocationInput) => {
    expectedInfos.push({ message, location: normalizeLocation(location) })
  }

  const expectHint = (message: string, location?: LocationInput) => {
    expectedHints.push({ message, location: normalizeLocation(location) })
  }

  const assertOffenses = (html: string, options?: any | TestOptions) => {
    if (expectedWarnings.length === 0 && expectedErrors.length === 0 && expectedInfos.length === 0 && expectedHints.length === 0) {
      throw new Error(
        "Cannot call assertOffenses() with no expectations. Use expectNoOffenses() instead."
      )
    }

    hasAsserted = true

    const context = options?.context ?? options
    const allowInvalidSyntax = options?.allowInvalidSyntax ?? false

    validateParserErrors(html, allowInvalidSyntax)

    const config = buildConfig()
    const ruleName = primaryRuleClass.ruleName
    const javascriptResult = lintWithMode(html, config, "javascript", context)

    const primaryOffenses = javascriptResult.offenses.filter(o => o.rule === ruleName)
    const primaryErrors = primaryOffenses.filter(o => o.severity === "error")
    const primaryWarnings = primaryOffenses.filter(o => o.severity === "warning")
    const primaryInfos = primaryOffenses.filter(o => o.severity === "info")
    const primaryHints = primaryOffenses.filter(o => o.severity === "hint")

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

    if (primaryInfos.length !== expectedInfos.length) {
      throw new Error(
        `Expected ${expectedInfos.length} info(s) from rule "${ruleName}" but found ${primaryInfos.length}.\n` +
        `Expected:\n${expectedInfos.map(i => `  - "${i.message}"`).join('\n')}\n` +
        `Actual:\n${primaryInfos.map(o => `  - "${o.message}" at ${o.location.start.line}:${o.location.start.column}`).join('\n')}`
      )
    }

    if (primaryHints.length !== expectedHints.length) {
      throw new Error(
        `Expected ${expectedHints.length} hint(s) from rule "${ruleName}" but found ${primaryHints.length}.\n` +
        `Expected:\n${expectedHints.map(h => `  - "${h.message}"`).join('\n')}\n` +
        `Actual:\n${primaryHints.map(o => `  - "${o.message}" at ${o.location.start.line}:${o.location.start.column}`).join('\n')}`
      )
    }

    primaryOffenses.forEach(offense => {
      expect(offense.rule).toBe(ruleName)
    })

    const actualErrors = primaryErrors
    const actualWarnings = primaryWarnings
    const actualInfos = primaryInfos
    const actualHints = primaryHints

    matchOffenses(expectedErrors, actualErrors, "error")
    matchOffenses(expectedWarnings, actualWarnings, "warning")
    matchOffenses(expectedInfos, actualInfos, "info")
    matchOffenses(expectedHints, actualHints, "hint")

    const rustResult = lintWithMode(html, config, "rust", context)
    compareBackendResults(javascriptResult, rustResult, "JavaScript", "Rust", ruleName, html)

    expectedWarnings.length = 0
    expectedErrors.length = 0
    expectedInfos.length = 0
    expectedHints.length = 0
  }

  return {
    expectNoOffenses,
    expectWarning,
    expectError,
    expectInfo,
    expectHint,
    assertOffenses
  }
}

function matchOffenses(
  expected: ExpectedOffense[],
  actual: any[],
  severity: "error" | "warning" | "info" | "hint"
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
