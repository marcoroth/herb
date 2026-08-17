import { describe, test, expect } from "vitest"

import { rules } from "../src/rules.js"

import * as ruleExports from "../src/rules/index.js"

describe("rule export completeness", () => {
  const exportedNames = new Set(Object.keys(ruleExports))

  test.each(rules.map(rule => [rule.ruleName, rule.name] as const))(
    "%s is exported from src/rules/index.ts",
    (_ruleName, className) => {
      expect(
        exportedNames.has(className),
        `Missing export in src/rules/index.ts for ${className}. Registered rules must also be re-exported so they are importable from the package.`
      ).toBe(true)
    }
  )
})
