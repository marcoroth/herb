import { describe, it, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../../src/linter.js"
import { HTMLAriaRoleMustBeValid } from "../../src/rules/html-aria-role-must-be-valid.js"

describe("html-aria-role-must-be-valid", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  it("should show an error for an invalid attrbute", () => {
    const html = '<div role="invalid-role"></div>'
    const result = Herb.parse(html)
    const linter = new Linter([HTMLAriaRoleMustBeValid])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(1)
  })

  it("should not show an error for valid attributes", () => {
    const html = '<div role="button">Click Me</div>'
    const result = Herb.parse(html)
    const linter = new Linter([HTMLAriaRoleMustBeValid])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(0)
  })
})
