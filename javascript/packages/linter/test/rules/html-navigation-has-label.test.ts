import { describe, test } from "vitest"
import { HTMLNavigationHasLabelRule } from "../../src/rules/html-navigation-has-label.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(HTMLNavigationHasLabelRule)

describe("html-navigation-has-label", () => {
  test("passes for nav with aria-label", () => {
    expectNoOffenses(`<nav aria-label="Main navigation"><a href="/">Home</a></nav>`)
  })

  test("passes for nav with aria-labelledby", () => {
    expectNoOffenses(`<nav aria-labelledby="nav-heading"><h2 id="nav-heading">Site Navigation</h2><a href="/">Home</a></nav>`)
  })

  test("passes for nav with both aria-label and aria-labelledby", () => {
    expectNoOffenses(`<nav aria-label="Primary" aria-labelledby="nav-heading"><h2 id="nav-heading">Navigation</h2><a href="/">Home</a></nav>`)
  })

  test("fails for nav without aria-label or aria-labelledby", () => {
    expectError("The navigation landmark should have a unique accessible name via `aria-label` or `aria-labelledby`. Remember that the name does not need to include \"navigation\" or \"nav\" since it will already be announced.")
    assertOffenses(`<nav><a href="/">Home</a><a href="/about">About</a></nav>`)
  })

  test("passes for element with role=navigation and aria-label", () => {
    expectNoOffenses(`<div role="navigation" aria-label="Breadcrumb navigation"><a href="/">Home</a></div>`)
  })

  test("passes for element with role=navigation and aria-labelledby", () => {
    expectNoOffenses(`<div role="navigation" aria-labelledby="breadcrumb-label"><span id="breadcrumb-label">Breadcrumb</span><a href="/">Home</a></div>`)
  })

  test("fails for element with role=navigation without labeling", () => {
    expectError("The navigation landmark should have a unique accessible name via `aria-label` or `aria-labelledby`. Remember that the name does not need to include \"navigation\" or \"nav\" since it will already be announced. Additionally, you can safely drop the `role=\"navigation\"` and replace it with the native HTML `<nav>` element.")
    assertOffenses(`<div role="navigation"><a href="/">Home</a><a href="/about">About</a></div>`)
  })

  test("ignores elements without navigation role", () => {
    expectNoOffenses(`<div><a href="/">Home</a><a href="/about">About</a></div>`)
  })

  test("ignores elements with other roles", () => {
    expectNoOffenses(`<div role="banner"><a href="/">Home</a></div>`)
  })

  test("handles mixed case attributes", () => {
    expectNoOffenses(`<nav ARIA-LABEL="Main navigation"><a href="/">Home</a></nav>`)
  })

  test("handles mixed case nav tag", () => {
    expectNoOffenses(`<NAV aria-label="Main navigation"><a href="/">Home</a></NAV>`)
  })

  test("handles multiple navigation elements", () => {
    expectError("The navigation landmark should have a unique accessible name via `aria-label` or `aria-labelledby`. Remember that the name does not need to include \"navigation\" or \"nav\" since it will already be announced.")
    assertOffenses(`
      <nav aria-label="Primary navigation"><a href="/">Home</a></nav>
      <nav><a href="/sitemap">Sitemap</a></nav>
      <div role="navigation" aria-label="Breadcrumb"><a href="/">Home</a></div>
    `)
  })

  test("passes for navigation with ERB content in labels", () => {
    expectNoOffenses(`<nav aria-label="<%= navigation_label %>"><a href="/">Home</a></nav>`)
  })

  test("passes for empty aria-label (technically has the attribute)", () => {
    expectNoOffenses(`<nav aria-label=""><a href="/">Home</a></nav>`)
  })

  test("passes for empty aria-labelledby (technically has the attribute)", () => {
    expectNoOffenses(`<nav aria-labelledby=""><a href="/">Home</a></nav>`)
  })
})
