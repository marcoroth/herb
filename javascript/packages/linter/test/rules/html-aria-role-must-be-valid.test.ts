import { describe, it, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../../src/linter.js"
import { HTMLAriaRoleMustBeValidRule } from "../../src/rules/html-aria-role-must-be-valid.js"

describe("html-aria-role-must-be-valid", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  it("should not show an error for valid attributes", () => {
    const html = '<div role="button">Click Me</div>'
    const linter = new Linter(Herb, [HTMLAriaRoleMustBeValidRule])

    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(0)
  })

  it("should show an error for an invalid attrbute", () => {
    const html = `<div role="invalid-role"></div>`
    const linter = new Linter(Herb, [HTMLAriaRoleMustBeValidRule])

    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.offenses[0].message).toBe("The `role` attribute must be a valid ARIA role. Role `invalid-role` is not recognized.")
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(1)
  })

  it("should not show an error for ERB content", () => {
    const html = `<div role="<%= role %>"></div>`
    const linter = new Linter(Herb, [HTMLAriaRoleMustBeValidRule])

    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(0)
  })

  it("should not show an error for static and ERB content", () => {
    const html = `<div role="invalid-role-<%= role %>"></div>`
    const linter = new Linter(Herb, [HTMLAriaRoleMustBeValidRule])

    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(0)
  })
})
