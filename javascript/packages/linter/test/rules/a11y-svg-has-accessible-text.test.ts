import { describe, test } from "vitest"
import { A11ySvgHasAccessibleTextRule } from "../../src/rules/a11y-svg-has-accessible-text.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectWarning, assertOffenses } = createLinterTest(A11ySvgHasAccessibleTextRule)

const offenseMessage = '`<svg>` must have accessible text. Set `aria-label`, or `aria-labelledby`, or nest a `<title>` element. If the `<svg>` is decorative, hide it with `aria-hidden="true"`.'

describe("a11y-svg-has-accessible-text", () => {
  test("passes for svg with aria-label", () => {
    expectNoOffenses('<svg aria-label="A circle" height="100" width="100"><circle cx="50" cy="50" r="40" /></svg>')
  })

  test("passes for svg with aria-labelledby", () => {
    expectNoOffenses('<svg aria-labelledby="circle_title" height="100" width="100"><circle cx="50" cy="50" r="40" /></svg>')
  })

  test("passes for svg with nested title element", () => {
    expectNoOffenses('<svg height="100" width="100"><title>A circle</title><circle cx="50" cy="50" r="40" /></svg>')
  })

  test("passes for svg with aria-hidden=true", () => {
    expectNoOffenses('<svg aria-hidden="true" height="100" width="100"><circle cx="50" cy="50" r="40" /></svg>')
  })

  test("fails for svg without accessible text", () => {
    expectWarning(offenseMessage)
    assertOffenses('<svg height="100" width="100"><circle cx="50" cy="50" r="40" /></svg>')
  })

  test("fails for empty svg without accessible text", () => {
    expectWarning(offenseMessage)
    assertOffenses('<svg></svg>')
  })

  test("fails for svg with aria-hidden=false", () => {
    expectWarning(offenseMessage)
    assertOffenses('<svg aria-hidden="false" height="100" width="100"><circle cx="50" cy="50" r="40" /></svg>')
  })

  test("ignores non-svg elements", () => {
    expectNoOffenses('<div height="100" width="100"></div>')
  })

  test("fails for multiple svg elements without accessible text", () => {
    expectWarning(offenseMessage)
    expectWarning(offenseMessage)
    assertOffenses('<svg></svg><svg></svg>')
  })

  test("passes for svg with both aria-label and title", () => {
    expectNoOffenses('<svg aria-label="A circle"><title>A circle</title></svg>')
  })
})
