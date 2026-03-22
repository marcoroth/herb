import { describe, it } from "vitest"
import { A11yAriaRoleMustBeValidRule } from "../../src/rules/a11y-aria-role-must-be-valid.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectWarning, assertOffenses } = createLinterTest(A11yAriaRoleMustBeValidRule)

describe("a11y-aria-role-must-be-valid", () => {
  it("should not show an error for valid attributes", () => {
    expectNoOffenses('<div role="button">Click Me</div>')
  })

  it("should show an error for an invalid attrbute", () => {
    expectWarning("The `role` attribute must be a valid ARIA role. Role `invalid-role` is not recognized.")

    assertOffenses(`<div role="invalid-role"></div>`)
  })

  it("should not show an error for ERB content", () => {
    expectNoOffenses(`<div role="<%= role %>"></div>`)
  })

  it("should not show an error for static and ERB content", () => {
    expectNoOffenses(`<div role="invalid-role-<%= role %>"></div>`)
  })
})
