import { describe, test, expect } from "vitest"
import { BUILT_IN_RULE_CONFIG_KEYS } from "@herb-tools/config"

import { rules } from "../src/rules.js"

describe("rule options reserved keys (#1204)", () => {
  test.each(rules.map(rule => [rule.ruleName, rule] as const))(
    "%s defaultOptions do not collide with built-in rule config keys",
    (_ruleName, ruleClass) => {
      const rule = new ruleClass()

      const collisions = Object.keys(rule.defaultOptions).filter(key =>
        (BUILT_IN_RULE_CONFIG_KEYS as readonly string[]).includes(key)
      )

      expect(
        collisions,
        `${rule.ruleName} declares defaultOptions keys reserved for built-in rule behavior: ${collisions.join(", ")}. Rename the option; built-in keys always win and are stripped before options are resolved.`
      ).toEqual([])
    }
  )
})
