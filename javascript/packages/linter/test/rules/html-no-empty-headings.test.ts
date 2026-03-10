import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../../src/linter.js"
import { HTMLNoEmptyHeadingsRule } from "../../src/rules/html-no-empty-headings.js"

describe("html-no-empty-headings", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("passes for heading with text content", () => {
    const html = '<h1>Heading Content</h1>'
    
    const linter = new Linter(Herb, [HTMLNoEmptyHeadingsRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(0)
  })

  test("passes for heading with nested elements", () => {
    const html = '<h2><span>Text</span></h2>'
    
    const linter = new Linter(Herb, [HTMLNoEmptyHeadingsRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(0)
  })

  test("passes for heading with ERB content", () => {
    const html = '<h3><%= title %></h3>'
    
    const linter = new Linter(Herb, [HTMLNoEmptyHeadingsRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(0)
  })

  test("fails for empty heading", () => {
    const html = '<h1></h1>'
    
    const linter = new Linter(Herb, [HTMLNoEmptyHeadingsRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(1)

    expect(lintResult.offenses[0].rule).toBe("html-no-empty-headings")
    expect(lintResult.offenses[0].message).toBe("Heading element `<h1>` must not be empty. Provide accessible text content for screen readers and SEO.")
    expect(lintResult.offenses[0].severity).toBe("error")
  })

  test("fails for heading with only whitespace", () => {
    const html = '<h2>   \n\t  </h2>'
    
    const linter = new Linter(Herb, [HTMLNoEmptyHeadingsRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(1)

    expect(lintResult.offenses[0].rule).toBe("html-no-empty-headings")
    expect(lintResult.offenses[0].message).toBe("Heading element `<h2>` must not be empty. Provide accessible text content for screen readers and SEO.")
  })

  test("fails for self-closing heading", () => {
    const html = '<h3 />'
    
    const linter = new Linter(Herb, [HTMLNoEmptyHeadingsRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(1)

    expect(lintResult.offenses[0].rule).toBe("html-no-empty-headings")
    expect(lintResult.offenses[0].message).toBe("Heading element `<h3>` must not be empty. Provide accessible text content for screen readers and SEO.")
  })

  test("handles all heading levels h1-h6", () => {
    const html = '<h1></h1><h2></h2><h3></h3><h4></h4><h5></h5><h6></h6>'
    
    const linter = new Linter(Herb, [HTMLNoEmptyHeadingsRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(6)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(6)

    expect(lintResult.offenses[0].message).toBe("Heading element `<h1>` must not be empty. Provide accessible text content for screen readers and SEO.")
    expect(lintResult.offenses[1].message).toBe("Heading element `<h2>` must not be empty. Provide accessible text content for screen readers and SEO.")
    expect(lintResult.offenses[5].message).toBe("Heading element `<h6>` must not be empty. Provide accessible text content for screen readers and SEO.")
  })

  test("handles mixed case heading tags", () => {
    const html = '<H1></H1>'
    
    const linter = new Linter(Herb, [HTMLNoEmptyHeadingsRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.offenses[0].message).toBe("Heading element `<h1>` must not be empty. Provide accessible text content for screen readers and SEO.")
  })

  test("ignores non-heading tags", () => {
    const html = '<div></div><p></p>'
    
    const linter = new Linter(Herb, [HTMLNoEmptyHeadingsRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
  })

  test("passes for headings with mixed content", () => {
    const html = '<h1>Welcome <%= user.name %>!</h1>'
    
    const linter = new Linter(Herb, [HTMLNoEmptyHeadingsRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
  })

  test("passes for heading with only ERB", () => {
    const html = '<h1><%= page.title %></h1>'
    
    const linter = new Linter(Herb, [HTMLNoEmptyHeadingsRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
  })

  test("handles multiple empty headings", () => {
    const html = '<h1></h1><h2>Valid</h2><h3></h3>'
    
    const linter = new Linter(Herb, [HTMLNoEmptyHeadingsRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(2)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(2)
  })

  test("passes for div with role='heading' and content", () => {
    const html = '<div role="heading" aria-level="1">Heading Content</div>'
    
    const linter = new Linter(Herb, [HTMLNoEmptyHeadingsRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(0)
  })

  test("fails for empty div with role='heading'", () => {
    const html = '<div role="heading" aria-level="1"></div>'
    
    const linter = new Linter(Herb, [HTMLNoEmptyHeadingsRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(1)

    expect(lintResult.offenses[0].rule).toBe("html-no-empty-headings")
    expect(lintResult.offenses[0].message).toBe('Heading element `<div role="heading">` must not be empty. Provide accessible text content for screen readers and SEO.')
    expect(lintResult.offenses[0].severity).toBe("error")
  })

  test("fails for div with role='heading' containing only whitespace", () => {
    const html = '<div role="heading" aria-level="2">   </div>'
    
    const linter = new Linter(Herb, [HTMLNoEmptyHeadingsRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(1)

    expect(lintResult.offenses[0].message).toBe('Heading element `<div role="heading">` must not be empty. Provide accessible text content for screen readers and SEO.')
  })

  test("fails for self-closing div with role='heading'", () => {
    const html = '<div role="heading" aria-level="3" />'
    
    const linter = new Linter(Herb, [HTMLNoEmptyHeadingsRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(1)

    expect(lintResult.offenses[0].message).toBe('Heading element `<div role="heading">` must not be empty. Provide accessible text content for screen readers and SEO.')
  })

  test("ignores div without role='heading'", () => {
    const html = '<div></div><div role="button">Button</div>'
    
    const linter = new Linter(Herb, [HTMLNoEmptyHeadingsRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(0)
  })

  test("handles mixed standard headings and ARIA headings", () => {
    const html = '<h1></h1><div role="heading">Valid</div><h2>Valid</h2><div role="heading"></div>'
    
    const linter = new Linter(Herb, [HTMLNoEmptyHeadingsRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(2)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(2)

    expect(lintResult.offenses[0].message).toBe("Heading element `<h1>` must not be empty. Provide accessible text content for screen readers and SEO.")
    expect(lintResult.offenses[1].message).toBe('Heading element `<div role="heading">` must not be empty. Provide accessible text content for screen readers and SEO.')
  })

  test("fails for heading with only aria-hidden content", () => {
    const html = '<h1><span aria-hidden="true">Inaccessible text</span></h1>'
    
    const linter = new Linter(Herb, [HTMLNoEmptyHeadingsRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(1)

    expect(lintResult.offenses[0].rule).toBe("html-no-empty-headings")
    expect(lintResult.offenses[0].message).toBe("Heading element `<h1>` must not be empty. Provide accessible text content for screen readers and SEO.")
    expect(lintResult.offenses[0].severity).toBe("error")
  })

  test("fails for heading with mixed accessible and inaccessible content", () => {
    const html = '<h2><span aria-hidden="true">Hidden</span><span aria-hidden="true">Also hidden</span></h2>'
    
    const linter = new Linter(Herb, [HTMLNoEmptyHeadingsRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(1)
  })

  test("passes for heading with mix of accessible and inaccessible content", () => {
    const html = '<h3>Visible text<span aria-hidden="true">Hidden text</span></h3>'
    
    const linter = new Linter(Herb, [HTMLNoEmptyHeadingsRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(0)
  })

  test("passes for heading itself with aria-hidden='true' but has content", () => {
    const html = '<h1 aria-hidden="true">Heading Content</h1>'
    
    const linter = new Linter(Herb, [HTMLNoEmptyHeadingsRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(0)
  })

  test("passes for heading itself with hidden attribute but has content", () => {
    const html = '<h2 hidden>Heading Content</h2>'
    
    const linter = new Linter(Herb, [HTMLNoEmptyHeadingsRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(0)
  })

  test("passes for heading with nested span containing text", () => {
    const html = '<h3><span>Text</span></h3>'
    
    const linter = new Linter(Herb, [HTMLNoEmptyHeadingsRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(0)
  })
})
