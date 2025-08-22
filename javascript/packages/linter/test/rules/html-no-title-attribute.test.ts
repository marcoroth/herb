import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../../src/linter.js"
import { HTMLNoTitleAttributeRule } from "../../src/rules/html-no-title-attribute.js"

describe("html-no-title-attribute", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("passes for elements without title attribute", () => {
    const html = '<button>Click me</button>'

    const linter = new Linter(Herb, [HTMLNoTitleAttributeRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(0)
  })

  test("passes for iframe with title attribute", () => {
    const html = '<iframe src="https://example.com" title="Example content"></iframe>'

    const linter = new Linter(Herb, [HTMLNoTitleAttributeRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
  })

  test("passes for link with title attribute", () => {
    const html = '<link rel="stylesheet" href="styles.css" title="Main styles">'

    const linter = new Linter(Herb, [HTMLNoTitleAttributeRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
  })

  test("fails for button with title attribute", () => {
    const html = '<button title="Click to submit">Submit</button>'

    const linter = new Linter(Herb, [HTMLNoTitleAttributeRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.offenses[0].rule).toBe("html-no-title-attribute")
    expect(lintResult.offenses[0].message).toBe("The `title` attribute should never be used as it is inaccessible for several groups of users. Use `aria-label` or `aria-describedby` instead. Exceptions are provided for `<iframe>` and `<link>` elements.")
  })

  test("fails for div with title attribute", () => {
    const html = '<div title="Additional information">Content</div>'

    const linter = new Linter(Herb, [HTMLNoTitleAttributeRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.offenses[0].rule).toBe("html-no-title-attribute")
  })

  test("fails for span with title attribute", () => {
    const html = '<span title="Tooltip text">Hover me</span>'

    const linter = new Linter(Herb, [HTMLNoTitleAttributeRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
  })

  test("fails for input with title attribute", () => {
    const html = '<input type="text" title="Enter your name" placeholder="Name">'

    const linter = new Linter(Herb, [HTMLNoTitleAttributeRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
  })

  test("fails for img with title attribute", () => {
    const html = '<img src="image.jpg" alt="Description" title="Additional info">'

    const linter = new Linter(Herb, [HTMLNoTitleAttributeRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
  })

  test("fails for anchor with title attribute", () => {
    const html = '<a href="/" title="Go to homepage">Home</a>'

    const linter = new Linter(Herb, [HTMLNoTitleAttributeRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
  })

  test("fails for abbr with title attribute", () => {
    const html = '<abbr title="World Wide Web">WWW</abbr>'

    const linter = new Linter(Herb, [HTMLNoTitleAttributeRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
  })

  test("handles mixed case element names", () => {
    const html = '<BUTTON title="Submit form">Submit</BUTTON>'

    const linter = new Linter(Herb, [HTMLNoTitleAttributeRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
  })

  test("handles mixed case title attribute", () => {
    const html = '<button TITLE="Submit form">Submit</button>'

    const linter = new Linter(Herb, [HTMLNoTitleAttributeRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
  })

  test("passes for mixed case allowed elements", () => {
    const html = '<IFRAME src="https://example.com" title="Content"></IFRAME>'

    const linter = new Linter(Herb, [HTMLNoTitleAttributeRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
  })

  test("handles multiple elements", () => {
    const html = `
      <iframe src="https://example.com" title="OK iframe"></iframe>
      <button title="Bad button">Click</button>
      <link rel="stylesheet" href="styles.css" title="OK link">
      <div title="Bad div">Content</div>
      <span>OK span</span>
    `

    const linter = new Linter(Herb, [HTMLNoTitleAttributeRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(2)
    expect(lintResult.offenses).toHaveLength(2)
  })

  test("passes for empty title attribute", () => {
    const html = '<button title="">Empty title</button>'

    const linter = new Linter(Herb, [HTMLNoTitleAttributeRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
  })

  test("passes for title attribute with ERB content", () => {
    const html = '<button title="<%= tooltip_text %>">Dynamic tooltip</button>'

    const linter = new Linter(Herb, [HTMLNoTitleAttributeRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
  })

  test("ignores elements with proper accessible alternatives", () => {
    const html = '<button aria-label="Submit form">Submit</button>'

    const linter = new Linter(Herb, [HTMLNoTitleAttributeRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
  })

  test("fails for self-closing elements with title", () => {
    const html = '<input type="text" title="Enter name" />'

    const linter = new Linter(Herb, [HTMLNoTitleAttributeRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
  })
})
