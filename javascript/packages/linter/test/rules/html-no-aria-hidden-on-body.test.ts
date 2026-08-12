import { describe, test } from "vitest"
import { HTMLNoAriaHiddenOnBodyRule } from "../../src/rules/html-no-aria-hidden-on-body.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectWarning, assertOffenses } = createLinterTest(HTMLNoAriaHiddenOnBodyRule)

describe("html-no-aria-hidden-on-body", () => {
  test("passes for body without aria-hidden", () => {
    expectNoOffenses('<body></body>')
  })

  test("passes for body with other attributes", () => {
    expectNoOffenses('<body class="main" id="app"></body>')
  })

  test("fails for body with aria-hidden boolean attribute", () => {
    expectWarning("The `aria-hidden` attribute should never be present on the `<body>` element, as it hides the entire document from assistive technology users.")

    assertOffenses('<body aria-hidden></body>')
  })

  test("fails for body with aria-hidden=\"true\"", () => {
    expectWarning("The `aria-hidden` attribute should never be present on the `<body>` element, as it hides the entire document from assistive technology users.")

    assertOffenses('<body aria-hidden="true"></body>')
  })

  test("passes for body with aria-hidden=\"false\"", () => {
    expectNoOffenses('<body aria-hidden="false"></body>')
  })

  test("fails for body with aria-hidden empty value", () => {
    expectWarning("The `aria-hidden` attribute should never be present on the `<body>` element, as it hides the entire document from assistive technology users.")

    assertOffenses('<body aria-hidden=""></body>')
  })

  test("passes for other elements with aria-hidden", () => {
    expectNoOffenses('<div aria-hidden="true"></div>')
  })

  test("handles uppercase BODY tag", () => {
    expectWarning("The `aria-hidden` attribute should never be present on the `<body>` element, as it hides the entire document from assistive technology users.")

    assertOffenses('<BODY aria-hidden="true"></BODY>')
  })

})
