import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../../src/linter.js"
import { HTMLIframeHasTitleRule } from "../../src/rules/html-iframe-has-title.js"

describe("html-iframe-has-title", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("passes for iframe with title attribute", () => {
    const html = '<iframe src="https://example.com" title="Example website content"></iframe>'

    const linter = new Linter(Herb, [HTMLIframeHasTitleRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(0)
  })

  test("fails for iframe with empty title attribute", () => {
    const html = '<iframe src="https://example.com" title=""></iframe>'

    const linter = new Linter(Herb, [HTMLIframeHasTitleRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses[0].message).toBe("`<iframe>` elements must have a `title` attribute that describes the content of the frame for screen reader users.")
  })

  test("fails for iframe with empty title attribute", () => {
    const html = '<iframe src="https://example.com" title=" "></iframe>'

    const linter = new Linter(Herb, [HTMLIframeHasTitleRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses[0].message).toBe("`<iframe>` elements must have a `title` attribute that describes the content of the frame for screen reader users.")
  })

  test("fails for iframe without title attribute", () => {
    const html = '<iframe src="https://example.com"></iframe>'

    const linter = new Linter(Herb, [HTMLIframeHasTitleRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.offenses[0].rule).toBe("html-iframe-has-title")
    expect(lintResult.offenses[0].message).toBe("`<iframe>` elements must have a `title` attribute that describes the content of the frame for screen reader users.")
  })

  test("fails for self-closing iframe without title", () => {
    const html = '<iframe src="https://example.com" />'

    const linter = new Linter(Herb, [HTMLIframeHasTitleRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.offenses[0].rule).toBe("html-iframe-has-title")
  })

  test("passes for iframe with descriptive title", () => {
    const html = '<iframe src="https://youtube.com/embed/123" title="Product demonstration video"></iframe>'

    const linter = new Linter(Herb, [HTMLIframeHasTitleRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
  })

  test("ignores non-iframe elements", () => {
    const html = '<div src="https://example.com">Not an iframe</div>'

    const linter = new Linter(Herb, [HTMLIframeHasTitleRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
  })

  test("ignores frame elements (different tag)", () => {
    const html = '<frame src="https://example.com">'

    const linter = new Linter(Herb, [HTMLIframeHasTitleRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
  })

  test("handles mixed case iframe tag", () => {
    const html = '<IFRAME src="https://example.com"></IFRAME>'

    const linter = new Linter(Herb, [HTMLIframeHasTitleRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.offenses[0].rule).toBe("html-iframe-has-title")
  })

  test("passes for mixed case title attribute", () => {
    const html = '<iframe src="https://example.com" TITLE="Example content"></iframe>'

    const linter = new Linter(Herb, [HTMLIframeHasTitleRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
  })

  test("handles multiple iframe elements", () => {
    const html = `
      <iframe src="https://example1.com" title="First iframe"></iframe>
      <iframe src="https://example2.com"></iframe>
      <iframe src="https://example3.com" title="Third iframe"></iframe>
    `

    const linter = new Linter(Herb, [HTMLIframeHasTitleRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.offenses).toHaveLength(1)
  })

  test("passes for iframe with ERB title content", () => {
    const html = '<iframe src="https://example.com" title="<%= content_title %>"></iframe>'

    const linter = new Linter(Herb, [HTMLIframeHasTitleRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
  })

  test("passes for iframe with multiple attributes", () => {
    const html = '<iframe src="https://example.com" width="600" height="400" frameborder="0" title="Embedded content"></iframe>'

    const linter = new Linter(Herb, [HTMLIframeHasTitleRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
  })

  test("fails for iframe with other attributes but no title", () => {
    const html = '<iframe src="https://example.com" width="600" height="400" frameborder="0"></iframe>'

    const linter = new Linter(Herb, [HTMLIframeHasTitleRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.offenses[0].rule).toBe("html-iframe-has-title")
  })

  test("passes for iframe with aria-hidden='true'", () => {
    const html = '<iframe aria-hidden="true"></iframe>'

    const linter = new Linter(Herb, [HTMLIframeHasTitleRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
  })
})
