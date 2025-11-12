import { describe, test } from "vitest"
import { HTMLNoEmptyHeadingsRule } from "../../src/rules/html-no-empty-headings.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(HTMLNoEmptyHeadingsRule)

describe("html-no-empty-headings", () => {
  test("passes for heading with text content", () => {
    expectNoOffenses('<h1>Heading Content</h1>')
  })

  test("passes for heading with nested elements", () => {
    expectNoOffenses('<h2><span>Text</span></h2>')
  })

  test("passes for heading with ERB content", () => {
    expectNoOffenses('<h3><%= title %></h3>')
  })

  test("fails for empty heading", () => {
    expectError("Heading element `<h1>` must not be empty. Provide accessible text content for screen readers and SEO.")

    assertOffenses('<h1></h1>')
  })

  test("fails for heading with only whitespace", () => {
    expectError("Heading element `<h2>` must not be empty. Provide accessible text content for screen readers and SEO.")

    assertOffenses('<h2>   \n\t  </h2>')
  })

  test("fails for self-closing heading", () => {
    expectError("Heading element `<h3>` must not be empty. Provide accessible text content for screen readers and SEO.")

    assertOffenses('<h3 />')
  })

  test("handles all heading levels h1-h6", () => {
    expectError("Heading element `<h1>` must not be empty. Provide accessible text content for screen readers and SEO.")
    expectError("Heading element `<h2>` must not be empty. Provide accessible text content for screen readers and SEO.")
    expectError("Heading element `<h3>` must not be empty. Provide accessible text content for screen readers and SEO.")
    expectError("Heading element `<h4>` must not be empty. Provide accessible text content for screen readers and SEO.")
    expectError("Heading element `<h5>` must not be empty. Provide accessible text content for screen readers and SEO.")
    expectError("Heading element `<h6>` must not be empty. Provide accessible text content for screen readers and SEO.")

    assertOffenses('<h1></h1><h2></h2><h3></h3><h4></h4><h5></h5><h6></h6>')
  })

  test("handles mixed case heading tags", () => {
    expectError("Heading element `<h1>` must not be empty. Provide accessible text content for screen readers and SEO.")

    assertOffenses('<H1></H1>')
  })

  test("ignores non-heading tags", () => {
    expectNoOffenses('<div></div><p></p>')
  })

  test("passes for headings with mixed content", () => {
    expectNoOffenses('<h1>Welcome <%= user.name %>!</h1>')
  })

  test("passes for heading with only ERB", () => {
    expectNoOffenses('<h1><%= page.title %></h1>')
  })

  test("handles multiple empty headings", () => {
    expectError("Heading element `<h1>` must not be empty. Provide accessible text content for screen readers and SEO.")
    expectError("Heading element `<h3>` must not be empty. Provide accessible text content for screen readers and SEO.")

    assertOffenses('<h1></h1><h2>Valid</h2><h3></h3>')
  })

  test("passes for div with role='heading' and content", () => {
    expectNoOffenses('<div role="heading" aria-level="1">Heading Content</div>')
  })

  test("fails for empty div with role='heading'", () => {
    expectError('Heading element `<div role="heading">` must not be empty. Provide accessible text content for screen readers and SEO.')

    assertOffenses('<div role="heading" aria-level="1"></div>')
  })

  test("fails for div with role='heading' containing only whitespace", () => {
    expectError('Heading element `<div role="heading">` must not be empty. Provide accessible text content for screen readers and SEO.')

    assertOffenses('<div role="heading" aria-level="2">   </div>')
  })

  test("fails for self-closing div with role='heading'", () => {
    expectError('Heading element `<div role="heading">` must not be empty. Provide accessible text content for screen readers and SEO.')

    assertOffenses('<div role="heading" aria-level="3" />')
  })

  test("ignores div without role='heading'", () => {
    expectNoOffenses('<div></div><div role="button">Button</div>')
  })

  test("handles mixed standard headings and ARIA headings", () => {
    expectError("Heading element `<h1>` must not be empty. Provide accessible text content for screen readers and SEO.")
    expectError('Heading element `<div role="heading">` must not be empty. Provide accessible text content for screen readers and SEO.')

    assertOffenses('<h1></h1><div role="heading">Valid</div><h2>Valid</h2><div role="heading"></div>')
  })

  test("fails for heading with only aria-hidden content", () => {
    expectError("Heading element `<h1>` must not be empty. Provide accessible text content for screen readers and SEO.")

    assertOffenses('<h1><span aria-hidden="true">Inaccessible text</span></h1>')
  })

  test("fails for heading with mixed accessible and inaccessible content", () => {
    expectError("Heading element `<h2>` must not be empty. Provide accessible text content for screen readers and SEO.")

    assertOffenses('<h2><span aria-hidden="true">Hidden</span><span aria-hidden="true">Also hidden</span></h2>')
  })

  test("passes for heading with mix of accessible and inaccessible content", () => {
    expectNoOffenses('<h3>Visible text<span aria-hidden="true">Hidden text</span></h3>')
  })

  test("passes for heading itself with aria-hidden='true' but has content", () => {
    expectNoOffenses('<h1 aria-hidden="true">Heading Content</h1>')
  })

  test("passes for heading itself with hidden attribute but has content", () => {
    expectNoOffenses('<h2 hidden>Heading Content</h2>')
  })

  test("passes for heading with nested span containing text", () => {
    expectNoOffenses('<h3><span>Text</span></h3>')
  })

  test("passes for heading with nested span containing text", () => {
    expectNoOffenses('<h2 class="class" data-turbo-temporary><%= content %></h2>')
  })
})
