import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../../src/linter.js"
import { HTMLAriaLabelIsWellFormattedRule } from "../../src/rules/html-aria-label-is-well-formatted.js"

describe("html-aria-label-is-well-formatted", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("passes for properly formatted aria-label", () => {
    const html = '<button aria-label="Close dialog">X</button>'

    const linter = new Linter(Herb, [HTMLAriaLabelIsWellFormattedRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(0)
  })

  test("passes for aria-label with proper sentence case", () => {
    const html = '<input aria-label="Search products" type="search">'

    const linter = new Linter(Herb, [HTMLAriaLabelIsWellFormattedRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
  })

  test("fails for aria-label starting with lowercase", () => {
    const html = '<button aria-label="close dialog">X</button>'

    const linter = new Linter(Herb, [HTMLAriaLabelIsWellFormattedRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.offenses[0].rule).toBe("html-aria-label-is-well-formatted")
    expect(lintResult.offenses[0].message).toBe("The `aria-label` attribute value text should be formatted like visual text. Use sentence case (capitalize the first letter).")
  })

  test("fails for aria-label with line breaks", () => {
    const html = '<button aria-label="Close\ndialog">X</button>'

    const linter = new Linter(Herb, [HTMLAriaLabelIsWellFormattedRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.offenses[0].message).toBe("The `aria-label` attribute value text should not contain line breaks. Use concise, single-line descriptions.")
  })

  test("fails for aria-label with carriage return", () => {
    const html = '<button aria-label="Close\rdialog">X</button>'

    const linter = new Linter(Herb, [HTMLAriaLabelIsWellFormattedRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.offenses[0].message).toBe("The `aria-label` attribute value text should not contain line breaks. Use concise, single-line descriptions.")
  })

  test("fails for aria-label with HTML entity line breaks", () => {
    const html = '<button aria-label="Close&#10;dialog">X</button>'

    const linter = new Linter(Herb, [HTMLAriaLabelIsWellFormattedRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.offenses[0].message).toBe("The `aria-label` attribute value text should not contain line breaks. Use concise, single-line descriptions.")
  })

  test("fails for snake_case aria-label", () => {
    const html = '<button aria-label="close_dialog">X</button>'

    const linter = new Linter(Herb, [HTMLAriaLabelIsWellFormattedRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.offenses[0].message).toBe("The `aria-label` attribute value should not be formatted like an ID. Use natural, sentence-case text instead.")
  })

  test("fails for kebab-case aria-label", () => {
    const html = '<button aria-label="close-dialog">X</button>'

    const linter = new Linter(Herb, [HTMLAriaLabelIsWellFormattedRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.offenses[0].message).toBe("The `aria-label` attribute value should not be formatted like an ID. Use natural, sentence-case text instead.")
  })

  test("fails for camelCase aria-label", () => {
    const html = '<button aria-label="closeDialog">X</button>'

    const linter = new Linter(Herb, [HTMLAriaLabelIsWellFormattedRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.offenses[0].message).toBe("The `aria-label` attribute value should not be formatted like an ID. Use natural, sentence-case text instead.")
  })

  test("passes for aria-label with spaces and proper formatting", () => {
    const html = '<button aria-label="Close the dialog">X</button>'

    const linter = new Linter(Herb, [HTMLAriaLabelIsWellFormattedRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
  })

  test("passes for aria-label with numbers", () => {
    const html = '<button aria-label="Page 2 of 10">2</button>'

    const linter = new Linter(Herb, [HTMLAriaLabelIsWellFormattedRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
  })

  test("ignores other attributes", () => {
    const html = '<button aria-labelledby="close_dialog_label">X</button>'

    const linter = new Linter(Herb, [HTMLAriaLabelIsWellFormattedRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
  })

  test("handles multiple elements", () => {
    const html = `
      <button aria-label="Close dialog">X</button>
      <input aria-label="search_field" type="text">
    `

    const linter = new Linter(Herb, [HTMLAriaLabelIsWellFormattedRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.offenses[0].message).toBe("The `aria-label` attribute value should not be formatted like an ID. Use natural, sentence-case text instead.")
  })

  test("passes for aria-label with ERB content", () => {
    const html = '<button aria-label="<%= action_label %>">Action</button>'

    const linter = new Linter(Herb, [HTMLAriaLabelIsWellFormattedRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
  })

  test("passes for mixed case attribute name", () => {
    const html = '<button ARIA-LABEL="Close dialog">X</button>'

    const linter = new Linter(Herb, [HTMLAriaLabelIsWellFormattedRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
  })
})
