import dedent from "dedent"
import { describe, it } from "vitest"
import { HTMLAriaAttributeMustBeValid } from "../../src/rules/html-aria-attribute-must-be-valid.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectWarning, assertOffenses } = createLinterTest(HTMLAriaAttributeMustBeValid)

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

    expectWarning('The attribute `aria-bogus` is not a valid ARIA attribute. ARIA attributes must match the WAI-ARIA specification.')
    assertOffenses(html)
  })

  it("fails for mistyped aria name", () => {
    const html = '<input type="text" aria-lable="Search" />'

    expectWarning('The attribute `aria-lable` is not a valid ARIA attribute. ARIA attributes must match the WAI-ARIA specification.')
    assertOffenses(html)
  })

  it("fails for aria-", () => {
    const html = '<input type="text" aria-="Search" />'

    expectWarning('The attribute `aria-` is not a valid ARIA attribute. ARIA attributes must match the WAI-ARIA specification.')
    assertOffenses(html)
  })

  it("fails for aria-labelled-by", () => {
    const html = dedent`
      <span role="checkbox" aria-checked="false" tabindex="0" aria-labelled-by="tac"></span>
      <span id="tac">I agree to the Terms and Conditions.</span>
    `

    expectWarning('The attribute `aria-labelled-by` is not a valid ARIA attribute. ARIA attributes must match the WAI-ARIA specification.')
    assertOffenses(html)
  })

  it("fails for aria-described-by", () => {
    const html = dedent`
      <input type="password" aria-described-by="pwd-help">
      <div id="pwd-help">Password must be at least 8 characters</div>
    `

    expectWarning('The attribute `aria-described-by` is not a valid ARIA attribute. ARIA attributes must match the WAI-ARIA specification.')
    assertOffenses(html)
  })

  describe("ActionView tag helpers", () => {
    it("passes for tag.div with a valid ARIA attribute", () => {
      expectNoOffenses('<%= tag.div aria: { label: "Close" } %>')
    })

    it("fails for tag.div with an invalid ARIA attribute", () => {
      expectWarning("The attribute `aria-labl` is not a valid ARIA attribute. ARIA attributes must match the WAI-ARIA specification.")

      assertOffenses('<%= tag.div aria: { labl: "Close" } %>')
    })

    it("fails for content_tag with an invalid ARIA attribute", () => {
      expectWarning("The attribute `aria-labl` is not a valid ARIA attribute. ARIA attributes must match the WAI-ARIA specification.")

      assertOffenses('<%= content_tag :div, "content", aria: { labl: "Close" } %>')
    })

    it("passes for a dynamic aria value", () => {
      expectNoOffenses('<%= tag.div aria: { label: label_text } %>')
    })

    it("still fails with a nil value, since the attribute name is what's invalid", () => {
      expectWarning("The attribute `aria-labl` is not a valid ARIA attribute. ARIA attributes must match the WAI-ARIA specification.")

      assertOffenses('<%= tag.div aria: { labl: nil } %>')
    })

    it("still fails with a dynamic value, since the attribute name is what's invalid", () => {
      expectWarning("The attribute `aria-labl` is not a valid ARIA attribute. ARIA attributes must match the WAI-ARIA specification.")

      assertOffenses('<%= tag.div aria: { labl: label_text } %>')
    })
  })
})
