import { afterEach, expect } from "vitest"
import dedent from "dedent"

import { dom, resetDOM } from "./dom.js"
import { createBrowserLinter } from "./browser-linter.js"

import type { LintOffense, LintSeverity, RuleClass } from "../../../src/types.js"

interface BrowserLinterTestHelpers {
  expectNoOffenses: (markup: string) => void
  expectError: (message: string) => void
  expectWarning: (message: string) => void
  expectInfo: (message: string) => void
  expectHint: (message: string) => void
  assertOffenses: (markup: string) => void
}

/**
 * A test helper for asking one rule about a rendered page, shaped the same way `createLinterTest`
 * is, so a rule reads the same whichever side it is being tested from.
 *
 * An expectation is a message and a severity. A location is left out, because markup written in a
 * test carries no stamp saying which template it came from.
 *
 * Works for a `BrowserRule` too, which is handed a real attached DOM instead of a string, since a
 * rule reading the CSSOM has nothing to read from markup that was never in the document.
 *
 * Markup that needs a parent to be parsed cannot be written here on its own. A bare `<tr>` or
 * `<option>` handed to the browser as a document is dropped, and the case would pass while
 * asserting nothing. Write the table or the select around it, the way a page would have it.
 *
 * The markup goes through the browser's own parser, which repairs as it reads. A rule looking for
 * something the parser fixes on the way in can never report it, so every rule declaring
 * `environments: ["cli", "browser"]` has a file beside this one proving it still can.
 *
 * @example
 * ```ts
 * const { expectNoOffenses, expectWarning, assertOffenses } = createBrowserRuleTest(MyRule)
 *
 * test("valid case", () => {
 *   expectNoOffenses(`<img src="/a.png" alt="a">`)
 * })
 *
 * test("invalid case", () => {
 *   expectWarning("Missing required `alt` attribute on `<img>` tag.")
 *
 *   assertOffenses(`<img src="/a.png">`)
 * })
 * ```
 */
export function createBrowserRuleTest(ruleClass: RuleClass): BrowserLinterTestHelpers {
  const expected: Record<LintSeverity, string[]> = { error: [], warning: [], info: [], hint: [] }
  let hasAsserted = false

  const pending = () => Object.values(expected).reduce((total, messages) => total + messages.length, 0)
  const needsLiveDOM = (ruleClass as { type?: string }).type === "browser"
  const lint = (markup: string): LintOffense[] => {
    const linter = createBrowserLinter({ only: [ruleClass.ruleName] })
    const source = needsLiveDOM ? dom(dedent(markup)) : dedent(markup)

    return linter
      .lint(source as never, { environment: "browser" })
      .offenses.filter((offense) => offense.rule === ruleClass.ruleName)
  }

  const report = (severity: LintSeverity, actual: LintOffense[]) =>
    `Expected ${expected[severity].length} ${severity}(s) from rule "${ruleClass.ruleName}" but found ${actual.length}.\n` +
    `Expected:\n${expected[severity].map((message) => `  - "${message}"`).join("\n")}\n` +
    `Actual:\n${actual.map((offense) => `  - "${offense.message}"`).join("\n")}`

  afterEach(resetDOM)

  afterEach(() => {
    if (!hasAsserted && pending() > 0) {
      throw new Error(
        `Test has ${pending()} pending expectation(s) that were never asserted. ` +
        `Did you forget to call assertOffenses() or expectNoOffenses()?`
      )
    }

    for (const severity of Object.keys(expected) as LintSeverity[]) expected[severity].length = 0

    hasAsserted = false
  })

  const expectSeverity = (severity: LintSeverity) => (message: string) => {
    expected[severity].push(message)
  }

  return {
    expectNoOffenses: (markup) => {
      if (pending() > 0) {
        throw new Error("Cannot call expectNoOffenses() after registering expectations with expectWarning(), expectError(), expectInfo() or expectHint()")
      }

      hasAsserted = true

      expect(lint(markup).map((offense) => offense.message)).toEqual([])
    },

    expectError: expectSeverity("error"),
    expectWarning: expectSeverity("warning"),
    expectInfo: expectSeverity("info"),
    expectHint: expectSeverity("hint"),

    assertOffenses: (markup) => {
      if (pending() === 0) {
        throw new Error("Cannot call assertOffenses() with no expectations. Use expectNoOffenses() instead.")
      }

      hasAsserted = true

      const offenses = lint(markup)

      for (const severity of Object.keys(expected) as LintSeverity[]) {
        const actual = offenses.filter((offense) => offense.severity === severity)

        if (actual.length !== expected[severity].length) throw new Error(report(severity, actual))

        expect(actual.map((offense) => offense.message)).toEqual(expected[severity])
      }
    },
  }
}
