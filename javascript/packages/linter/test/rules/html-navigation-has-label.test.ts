import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../../src/linter.js"
import { HTMLNavigationHasLabelRule } from "../../src/rules/html-navigation-has-label.js"

describe("html-navigation-has-label", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("passes for nav with aria-label", () => {
    const html = '<nav aria-label="Main navigation"><a href="/">Home</a></nav>'

    const linter = new Linter(Herb, [HTMLNavigationHasLabelRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(0)
  })

  test("passes for nav with aria-labelledby", () => {
    const html = '<nav aria-labelledby="nav-heading"><h2 id="nav-heading">Site Navigation</h2><a href="/">Home</a></nav>'

    const linter = new Linter(Herb, [HTMLNavigationHasLabelRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
  })

  test("passes for nav with both aria-label and aria-labelledby", () => {
    const html = '<nav aria-label="Primary" aria-labelledby="nav-heading"><h2 id="nav-heading">Navigation</h2><a href="/">Home</a></nav>'

    const linter = new Linter(Herb, [HTMLNavigationHasLabelRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
  })

  test("fails for nav without aria-label or aria-labelledby", () => {
    const html = '<nav><a href="/">Home</a><a href="/about">About</a></nav>'

    const linter = new Linter(Herb, [HTMLNavigationHasLabelRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.offenses[0].rule).toBe("html-navigation-has-label")
    expect(lintResult.offenses[0].message).toBe("The navigation landmark should have a unique accessible name via `aria-label` or `aria-labelledby`. Remember that the name does not need to include \"navigation\" or \"nav\" since it will already be announced.")
  })

  test("passes for element with role=navigation and aria-label", () => {
    const html = '<div role="navigation" aria-label="Breadcrumb navigation"><a href="/">Home</a></div>'

    const linter = new Linter(Herb, [HTMLNavigationHasLabelRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
  })

  test("passes for element with role=navigation and aria-labelledby", () => {
    const html = '<div role="navigation" aria-labelledby="breadcrumb-label"><span id="breadcrumb-label">Breadcrumb</span><a href="/">Home</a></div>'

    const linter = new Linter(Herb, [HTMLNavigationHasLabelRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
  })

  test("fails for element with role=navigation without labeling", () => {
    const html = '<div role="navigation"><a href="/">Home</a><a href="/about">About</a></div>'

    const linter = new Linter(Herb, [HTMLNavigationHasLabelRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.offenses[0].rule).toBe("html-navigation-has-label")
    expect(lintResult.offenses[0].message).toBe("The navigation landmark should have a unique accessible name via `aria-label` or `aria-labelledby`. Remember that the name does not need to include \"navigation\" or \"nav\" since it will already be announced. Additionally, you can safely drop the `role=\"navigation\"` and replace it with the native HTML `<nav>` element.")
  })

  test("ignores elements without navigation role", () => {
    const html = '<div><a href="/">Home</a><a href="/about">About</a></div>'

    const linter = new Linter(Herb, [HTMLNavigationHasLabelRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
  })

  test("ignores elements with other roles", () => {
    const html = '<div role="banner"><a href="/">Home</a></div>'

    const linter = new Linter(Herb, [HTMLNavigationHasLabelRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
  })

  test("handles mixed case attributes", () => {
    const html = '<nav ARIA-LABEL="Main navigation"><a href="/">Home</a></nav>'

    const linter = new Linter(Herb, [HTMLNavigationHasLabelRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
  })

  test("handles mixed case nav tag", () => {
    const html = '<NAV aria-label="Main navigation"><a href="/">Home</a></NAV>'

    const linter = new Linter(Herb, [HTMLNavigationHasLabelRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
  })

  test("handles multiple navigation elements", () => {
    const html = `
      <nav aria-label="Primary navigation"><a href="/">Home</a></nav>
      <nav><a href="/sitemap">Sitemap</a></nav>
      <div role="navigation" aria-label="Breadcrumb"><a href="/">Home</a></div>
    `

    const linter = new Linter(Herb, [HTMLNavigationHasLabelRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.offenses).toHaveLength(1)
  })

  test("passes for navigation with ERB content in labels", () => {
    const html = '<nav aria-label="<%= navigation_label %>"><a href="/">Home</a></nav>'

    const linter = new Linter(Herb, [HTMLNavigationHasLabelRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
  })

  test("passes for empty aria-label (technically has the attribute)", () => {
    const html = '<nav aria-label=""><a href="/">Home</a></nav>'

    const linter = new Linter(Herb, [HTMLNavigationHasLabelRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
  })

  test("passes for empty aria-labelledby (technically has the attribute)", () => {
    const html = '<nav aria-labelledby=""><a href="/">Home</a></nav>'

    const linter = new Linter(Herb, [HTMLNavigationHasLabelRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
  })
})
