import dedent from "dedent"
import { describe, it } from "vitest"
import { HTMLAriaAttributeMustBeValid } from "../../src/rules/html-aria-attribute-must-be-valid.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(HTMLAriaAttributeMustBeValid)

describe("html-aria-attribute-must-be-valid", () => {
  it("allows a div with a valid aria attribute", () => {
    const html = '<div aria-label="Section Title"></div>'

    expectNoOffenses(html)
  })

  it("ignores non-aria attributes", () => {
    const html = '<div class="foo"></div>'

    expectNoOffenses(html)
  })

  it("fails when a div has an invalid aria attribute", () => {
    const html = '<div aria-bogus="foo"></div>'

    expectError('The attribute `aria-bogus` is not a valid ARIA attribute. ARIA attributes must match the WAI-ARIA specification.')
    assertOffenses(html)
  })

  it("fails for mistyped aria name", () => {
    const html = '<input type="text" aria-lable="Search" />'

    expectError('The attribute `aria-lable` is not a valid ARIA attribute. ARIA attributes must match the WAI-ARIA specification.')
    assertOffenses(html)
  })

  it("fails for aria-", () => {
    const html = '<input type="text" aria-="Search" />'

    expectError('The attribute `aria-` is not a valid ARIA attribute. ARIA attributes must match the WAI-ARIA specification.')
    assertOffenses(html)
  })

  it("fails for aria-labelled-by", () => {
    const html = dedent`
      <span role="checkbox" aria-checked="false" tabindex="0" aria-labelled-by="tac"></span>
      <span id="tac">I agree to the Terms and Conditions.</span>
    `

    expectError('The attribute `aria-labelled-by` is not a valid ARIA attribute. ARIA attributes must match the WAI-ARIA specification.')
    assertOffenses(html)
  })

  it("fails for aria-described-by", () => {
    const html = dedent`
      <input type="password" aria-described-by="pwd-help">
      <div id="pwd-help">Password must be at least 8 characters</div>
    `

    expectError('The attribute `aria-described-by` is not a valid ARIA attribute. ARIA attributes must match the WAI-ARIA specification.')
    assertOffenses(html)
  })
})
