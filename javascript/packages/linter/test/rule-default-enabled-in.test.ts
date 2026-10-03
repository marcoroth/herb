import { describe, test, expect } from "vitest"

import { rules } from "../src/rules.js"
import { Linter } from "../src/linter.js"
import { ParserRule } from "../src/types.js"
import { compareSemver, UNRELEASED_VERSION } from "@herb-tools/core"

import type { FullRuleConfig } from "../src/types.js"

const enabledByDefault = rules.filter(rule => new rule().defaultConfig?.enabled !== false)
const disabledByDefault = rules.filter(rule => new rule().defaultConfig?.enabled === false)

describe("defaultEnabledIn metadata", () => {
  test.each(enabledByDefault.map(rule => [rule.ruleName, rule] as const))(
    "%s declares defaultEnabledIn",
    (_ruleName, rule) => {
      expect(
        rule.defaultEnabledIn,
        `${rule.ruleName} is enabled by default, so it must declare 'static defaultEnabledIn' saying which version switched it on.`
      ).toBeDefined()
    }
  )

  test.each(disabledByDefault.map(rule => [rule.ruleName, rule] as const))(
    "%s does not declare defaultEnabledIn",
    (_ruleName, rule) => {
      expect(
        rule.defaultEnabledIn,
        `${rule.ruleName} is disabled by default, so it must not declare 'defaultEnabledIn'. Set it in the same change that switches the rule on.`
      ).toBeUndefined()
    }
  )

  test.each(enabledByDefault.map(rule => [rule.ruleName, rule] as const))(
    "%s was not enabled before it was introduced",
    (_ruleName, rule) => {
      if (rule.introducedIn === UNRELEASED_VERSION) return

      expect(
        compareSemver(rule.defaultEnabledIn!, rule.introducedIn) >= 0,
        `${rule.ruleName} claims defaultEnabledIn ${rule.defaultEnabledIn}, which is older than introducedIn ${rule.introducedIn}.`
      ).toBe(true)
    }
  )

  test("html-no-space-in-tag records both its real age and its re-enable", () => {
    const rule = rules.find(rule => rule.ruleName === "html-no-space-in-tag")!

    expect(rule.introducedIn).toBe("0.8.0")
    expect(rule.defaultEnabledIn).toBe("0.10.3")
  })
})

describe("version gating on defaultEnabledIn", () => {
  class ReEnabledRule extends ParserRule {
    static ruleName = "test-re-enabled"
    static introducedIn = this.version("0.8.0")
    static defaultEnabledIn = this.version("0.10.3")

    get defaultConfig(): FullRuleConfig {
      return { enabled: true, severity: "error" }
    }

    check() { return [] }
  }

  class OldRule extends ParserRule {
    static ruleName = "test-old"
    static introducedIn = this.version("0.8.0")
    static defaultEnabledIn = this.version("0.8.0")

    get defaultConfig(): FullRuleConfig {
      return { enabled: true, severity: "error" }
    }

    check() { return [] }
  }

  test("gates a rule whose default was switched on after the config version", () => {
    const { enabled, skippedByVersion } = Linter.filterRulesByConfig([ReEnabledRule as any], undefined, "0.10.2")

    expect(enabled).toHaveLength(0)
    expect(skippedByVersion).toEqual([
      { ruleName: "test-re-enabled", introducedIn: "0.8.0", defaultEnabledIn: "0.10.3" }
    ])
  })

  test("enables it once the config version catches up", () => {
    const { enabled, skippedByVersion } = Linter.filterRulesByConfig([ReEnabledRule as any], undefined, "0.10.3")

    expect(enabled).toHaveLength(1)
    expect(skippedByVersion).toHaveLength(0)
  })

  test("does not gate a rule that has been enabled since it was introduced", () => {
    const { enabled, skippedByVersion } = Linter.filterRulesByConfig([OldRule as any], undefined, "0.10.2")

    expect(enabled).toHaveLength(1)
    expect(skippedByVersion).toHaveLength(0)
  })

  test("an explicit user setting still wins over the gate", () => {
    const { enabled, skippedByVersion } = Linter.filterRulesByConfig(
      [ReEnabledRule as any],
      { "test-re-enabled": { enabled: true } },
      "0.10.2"
    )

    expect(enabled).toHaveLength(1)
    expect(skippedByVersion).toHaveLength(0)
  })
})
