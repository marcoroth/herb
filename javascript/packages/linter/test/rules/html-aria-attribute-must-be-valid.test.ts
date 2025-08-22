import dedent from "dedent"
import { describe, it, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../../src/linter.js"
import { HTMLAriaAttributeMustBeValid } from "../../src/rules/html-aria-attribute-must-be-valid.js"

describe("html-aria-attribute-must-be-valid", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  it("allows a div with a valid aria attribute", () => {
    const html = '<div aria-label="Section Title"></div>'

    const linter = new Linter(Herb, [HTMLAriaAttributeMustBeValid])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(0)
  })

  it("ignores non-aria attributes", () => {
    const html = '<div class="foo"></div>'

    const linter = new Linter(Herb, [HTMLAriaAttributeMustBeValid])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(0)
  })

  it("fails when a div has an invalid aria attribute", () => {
    const html = '<div aria-bogus="foo"></div>'

    const linter = new Linter(Herb, [HTMLAriaAttributeMustBeValid])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(1)
    expect(lintResult.offenses[0].message).toBe(
      'The attribute `aria-bogus` is not a valid ARIA attribute. ARIA attributes must match the WAI-ARIA specification.'
    )
  })

  it("fails for mistyped aria name", () => {
    const html = '<input type="text" aria-lable="Search" />'

    const linter = new Linter(Herb, [HTMLAriaAttributeMustBeValid])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(1)
    expect(lintResult.offenses[0].message).toBe(
      'The attribute `aria-lable` is not a valid ARIA attribute. ARIA attributes must match the WAI-ARIA specification.'
    )
  })

  it("fails for aria-", () => {
    const html = '<input type="text" aria-="Search" />'

    const linter = new Linter(Herb, [HTMLAriaAttributeMustBeValid])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(1)
    expect(lintResult.offenses[0].message).toBe(
      'The attribute `aria-` is not a valid ARIA attribute. ARIA attributes must match the WAI-ARIA specification.'
    )
  })

  it("fails for aria-labelled-by", () => {
    const html = dedent`
      <span role="checkbox" aria-checked="false" tabindex="0" aria-labelled-by="tac"></span>
      <span id="tac">I agree to the Terms and Conditions.</span>
    `

    const linter = new Linter(Herb, [HTMLAriaAttributeMustBeValid])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(1)
    expect(lintResult.offenses[0].message).toBe(
      'The attribute `aria-labelled-by` is not a valid ARIA attribute. ARIA attributes must match the WAI-ARIA specification.'
    )
  })

  it("fails for aria-described-by", () => {
    const html = dedent`
      <input type="password" aria-described-by="pwd-help">
      <div id="pwd-help">Password must be at least 8 characters</div>
    `

    const linter = new Linter(Herb, [HTMLAriaAttributeMustBeValid])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(1)
    expect(lintResult.offenses[0].message).toBe(
      'The attribute `aria-described-by` is not a valid ARIA attribute. ARIA attributes must match the WAI-ARIA specification.'
    )
  })
})
