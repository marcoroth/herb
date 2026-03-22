import { describe, it } from "vitest"
import { A11yAriaRoleHeadingRequiresLevelRule } from "../../src/rules/a11y-aria-role-heading-requires-level.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectWarning, assertOffenses } = createLinterTest(A11yAriaRoleHeadingRequiresLevelRule)

describe("a11y-aria-role-heading-requires-level", () => {
  it("allows a div with the proper heading", () => {
    expectNoOffenses('<div role="heading" aria-level="2">Section Title</div>')
  })

  it("fails when role=heading is used without aria-level", () => {
    expectWarning(`Element with \`role="heading"\` must have an \`aria-level\` attribute.`)

    assertOffenses('<div role="heading">Section Title</div>')
  })
})
