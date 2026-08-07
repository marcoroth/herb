import { describe, it } from "vitest"
import { HTMLAriaRoleMustBeValidRule } from "../../src/rules/html-aria-role-must-be-valid.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectWarning, assertOffenses } = createLinterTest(HTMLAriaRoleMustBeValidRule)

describe("html-aria-role-must-be-valid", () => {
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

  it("allows WAI-ARIA Graphics module roles", () => {
    expectNoOffenses('<div role="graphics-symbol"></div>')
    expectNoOffenses('<div role="graphics-document"></div>')
    expectNoOffenses('<div role="graphics-object"></div>')
  })

  it("rejects abstract roles that may not be used directly", () => {
    expectWarning("The `role` attribute must be a valid ARIA role. Role `roletype` is not recognized.")

    assertOffenses('<div role="roletype"></div>')
  })

  describe("ActionView tag helpers", () => {
    it("passes for tag.div with a valid role", () => {
      expectNoOffenses('<%= tag.div role: "button" %>')
    })

    it("fails for tag.div with an invalid role", () => {
      expectWarning("The `role` attribute must be a valid ARIA role. Role `buton` is not recognized.")

      assertOffenses('<%= tag.div role: "buton" %>')
    })

    it("fails for content_tag with an invalid role", () => {
      expectWarning("The `role` attribute must be a valid ARIA role. Role `buton` is not recognized.")

      assertOffenses('<%= content_tag :div, "content", role: "buton" %>')
    })

    it("passes for a dynamic role, which can't be resolved statically", () => {
      expectNoOffenses('<%= tag.div role: role_name %>')
    })

    it("passes for a nil role, which ActionView omits entirely", () => {
      expectNoOffenses('<%= tag.div role: nil %>')
    })

    it("passes for an interpolated role", () => {
      expectNoOffenses('<%= tag.div role: "but#{suffix}" %>')
    })
  })
})
