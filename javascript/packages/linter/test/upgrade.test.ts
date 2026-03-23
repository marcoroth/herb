import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../src/linter.js"
import { rules } from "../src/rules.js"
import { HTMLTagNameLowercaseRule } from "../src/rules/html-tag-name-lowercase.js"
import { HTMLNoSelfClosingRule } from "../src/rules/html-no-self-closing.js"
import { HTMLImgRequireAltRule } from "../src/rules/html-img-require-alt.js"
import { HTMLNoDuplicateAttributesRule } from "../src/rules/html-no-duplicate-attributes.js"

import type { VersionSkippedRule } from "../src/linter.js"
import type { RuleClass } from "../src/types.js"

describe("Smart upgrade", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  describe("filterRulesByConfig version gating", () => {
    test("rules introduced after config version are skipped", () => {
      const { skippedByVersion } = Linter.filterRulesByConfig(rules, {}, "0.4.0")

      expect(skippedByVersion.length).toBeGreaterThan(0)
      expect(skippedByVersion.every(rule => rule.introducedIn > "0.4.0")).toBe(true)
    })

    test("rules at or before config version are enabled", () => {
      const { enabled, skippedByVersion } = Linter.filterRulesByConfig(rules, {}, "0.4.0")

      expect(enabled.length).toBeGreaterThan(0)

      const skippedNames = new Set(skippedByVersion.map(rule => rule.ruleName))
      const enabledNames = new Set(enabled.map(rule => rule.ruleName))

      for (const name of enabledNames) {
        expect(skippedNames.has(name)).toBe(false)
      }
    })

    test("explicitly enabled rules bypass version gating", () => {
      const { enabled } = Linter.filterRulesByConfig(rules, {
        "actionview-no-unnecessary-tag-attributes": { enabled: true }
      }, "0.4.0")

      const enabledNames = enabled.map(rule => rule.ruleName)
      expect(enabledNames).toContain("actionview-no-unnecessary-tag-attributes")
    })

    test("explicitly disabled rules are not enabled", () => {
      const { enabled } = Linter.filterRulesByConfig(rules, {
        "html-tag-name-lowercase": { enabled: false }
      }, "0.4.0")

      const enabledNames = enabled.map(rule => rule.ruleName)
      expect(enabledNames).not.toContain("html-tag-name-lowercase")
    })
  })

  describe("offense-based rule splitting", () => {
    function splitRules(skippedByVersion: VersionSkippedRule[], ruleClasses: RuleClass[], source: string, fileName?: string) {
      const linter = new Linter(Herb, ruleClasses)
      const result = linter.lint(source, { fileName })
      const ruleOffenseCounts = new Map<string, number>()

      for (const offense of result.offenses) {
        ruleOffenseCounts.set(offense.rule, (ruleOffenseCounts.get(offense.rule) || 0) + 1)
      }

      const rulesToDisable = skippedByVersion.filter(rule => ruleOffenseCounts.has(rule.ruleName))
      const rulesToEnable = skippedByVersion.filter(rule => !ruleOffenseCounts.has(rule.ruleName))

      return { rulesToDisable, rulesToEnable, ruleOffenseCounts }
    }

    test("rules with no offenses are marked to enable", () => {
      const skippedByVersion: VersionSkippedRule[] = [
        { ruleName: "html-tag-name-lowercase", introducedIn: "0.5.0" },
        { ruleName: "html-img-require-alt", introducedIn: "0.5.0" },
      ]

      const { rulesToEnable, rulesToDisable } = splitRules(
        skippedByVersion,
        [HTMLTagNameLowercaseRule, HTMLImgRequireAltRule],
        '<div><img src="logo.png" alt="Logo"></div>'
      )

      expect(rulesToEnable.map(rule => rule.ruleName)).toContain("html-tag-name-lowercase")
      expect(rulesToEnable.map(rule => rule.ruleName)).toContain("html-img-require-alt")
      expect(rulesToDisable).toHaveLength(0)
    })

    test("rules with offenses are marked to disable", () => {
      const skippedByVersion: VersionSkippedRule[] = [
        { ruleName: "html-tag-name-lowercase", introducedIn: "0.5.0" },
        { ruleName: "html-img-require-alt", introducedIn: "0.5.0" },
      ]

      const { rulesToEnable, rulesToDisable, ruleOffenseCounts } = splitRules(
        skippedByVersion,
        [HTMLTagNameLowercaseRule, HTMLImgRequireAltRule],
        '<DIV><img src="logo.png"></DIV>'
      )

      expect(rulesToDisable.map(rule => rule.ruleName)).toContain("html-tag-name-lowercase")
      expect(rulesToDisable.map(rule => rule.ruleName)).toContain("html-img-require-alt")
      expect(rulesToEnable).toHaveLength(0)
      expect(ruleOffenseCounts.get("html-tag-name-lowercase")).toBe(2)
      expect(ruleOffenseCounts.get("html-img-require-alt")).toBe(1)
    })

    test("splits rules correctly when some have offenses and some do not", () => {
      const skippedByVersion: VersionSkippedRule[] = [
        { ruleName: "html-tag-name-lowercase", introducedIn: "0.5.0" },
        { ruleName: "html-img-require-alt", introducedIn: "0.5.0" },
        { ruleName: "html-no-duplicate-attributes", introducedIn: "0.5.0" },
      ]

      const { rulesToEnable, rulesToDisable } = splitRules(
        skippedByVersion,
        [HTMLTagNameLowercaseRule, HTMLImgRequireAltRule, HTMLNoDuplicateAttributesRule],
        '<div><img src="logo.png"></div>'
      )

      expect(rulesToEnable.map(rule => rule.ruleName)).toContain("html-tag-name-lowercase")
      expect(rulesToEnable.map(rule => rule.ruleName)).toContain("html-no-duplicate-attributes")
      expect(rulesToDisable.map(rule => rule.ruleName)).toContain("html-img-require-alt")
    })

    test("all rules enabled when source is clean", () => {
      const skippedByVersion: VersionSkippedRule[] = [
        { ruleName: "html-tag-name-lowercase", introducedIn: "0.5.0" },
        { ruleName: "html-no-self-closing", introducedIn: "0.5.0" },
      ]

      const { rulesToEnable, rulesToDisable } = splitRules(
        skippedByVersion,
        [HTMLTagNameLowercaseRule, HTMLNoSelfClosingRule],
        '<div>Clean content</div>'
      )

      expect(rulesToEnable).toHaveLength(2)
      expect(rulesToDisable).toHaveLength(0)
    })
  })

})
