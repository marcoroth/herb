import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../../src/linter.js"
import { HTMLNoPositiveTabIndexRule } from "../../src/rules/html-no-positive-tab-index.js"

describe("html-no-positive-tab-index", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("passes for element without tabindex", () => {
    const html = '<button>Click me</button>'

    const linter = new Linter(Herb, [HTMLNoPositiveTabIndexRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(0)
  })

  test("passes for tabindex=\"0\"", () => {
    const html = '<div tabindex="0">Focusable div</div>'

    const linter = new Linter(Herb, [HTMLNoPositiveTabIndexRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
  })

  test("passes for tabindex=\"-1\"", () => {
    const html = '<div tabindex="-1">Programmatically focusable div</div>'

    const linter = new Linter(Herb, [HTMLNoPositiveTabIndexRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
  })

  test("passes for negative tabindex values", () => {
    const html = '<div tabindex="-5">Skip in tab order</div>'

    const linter = new Linter(Herb, [HTMLNoPositiveTabIndexRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
  })

  test("fails for tabindex=\"1\"", () => {
    const html = '<div tabindex="1">Bad tabindex</div>'

    const linter = new Linter(Herb, [HTMLNoPositiveTabIndexRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.offenses[0].rule).toBe("html-no-positive-tab-index")
    expect(lintResult.offenses[0].message).toBe("Do not use positive `tabindex` values as they are error prone and can severely disrupt navigation experience for keyboard users. Use `tabindex=\"0\"` to make an element focusable or `tabindex=\"-1\"` to remove it from the tab sequence.")
  })

  test("fails for tabindex=\"2\"", () => {
    const html = '<button tabindex="2">Bad button</button>'

    const linter = new Linter(Herb, [HTMLNoPositiveTabIndexRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.offenses[0].rule).toBe("html-no-positive-tab-index")
  })

  test("fails for high positive tabindex", () => {
    const html = '<input tabindex="999" type="text">'

    const linter = new Linter(Herb, [HTMLNoPositiveTabIndexRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.offenses[0].rule).toBe("html-no-positive-tab-index")
  })

  test("handles multiple elements with mixed tabindex values", () => {
    const html = `
      <button tabindex="0">OK</button>
      <button tabindex="1">Bad</button>
      <button tabindex="-1">Skip</button>
      <button tabindex="2">Also bad</button>
    `

    const linter = new Linter(Herb, [HTMLNoPositiveTabIndexRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(2)
    expect(lintResult.offenses).toHaveLength(2)
  })

  test("passes for non-numeric tabindex values", () => {
    const html = '<div tabindex="invalid">Should be handled by other rules</div>'

    const linter = new Linter(Herb, [HTMLNoPositiveTabIndexRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
  })

  test("passes for empty tabindex", () => {
    const html = '<div tabindex="">Empty value</div>'

    const linter = new Linter(Herb, [HTMLNoPositiveTabIndexRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
  })

  test("passes for tabindex with ERB content", () => {
    const html = '<div tabindex="<%= tab_index %>">Dynamic tabindex</div>'

    const linter = new Linter(Herb, [HTMLNoPositiveTabIndexRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
  })

  test("handles mixed case attribute names", () => {
    const html = '<div TABINDEX="1">Mixed case</div>'

    const linter = new Linter(Herb, [HTMLNoPositiveTabIndexRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.offenses[0].message).toBe("Do not use positive `tabindex` values as they are error prone and can severely disrupt navigation experience for keyboard users. Use `tabindex=\"0\"` to make an element focusable or `tabindex=\"-1\"` to remove it from the tab sequence.")
    expect(lintResult.offenses[0].rule).toBe("html-no-positive-tab-index")
  })

  test("handles tabindex with leading/trailing spaces", () => {
    const html = '<div tabindex="  1  ">With spaces</div>'

    const linter = new Linter(Herb, [HTMLNoPositiveTabIndexRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.offenses[0].rule).toBe("html-no-positive-tab-index")
  })
})
