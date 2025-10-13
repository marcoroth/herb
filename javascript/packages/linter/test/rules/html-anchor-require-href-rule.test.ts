import { describe, test } from "vitest"
import { HTMLAnchorRequireHrefRule } from "../../src/rules/html-anchor-require-href.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(HTMLAnchorRequireHrefRule)

describe("html-anchor-require-href", () => {
  test("passes for a with href attribute", () => {
    expectNoOffenses('<a href="http://example.com">My link</a>')
  })

  test("fails for a without href attribute", () => {
    expectError("Add an `href` attribute to `<a>` to ensure it is focusable and accessible.")

    assertOffenses("<a>My link</a>")
  })

  test("fails for multiple a tags without href", () => {
    expectError("Add an `href` attribute to `<a>` to ensure it is focusable and accessible.")
    expectError("Add an `href` attribute to `<a>` to ensure it is focusable and accessible.")

    assertOffenses("<a>My link</a><a>My other link</a>")
  })

  test("passes for img with ERB alt attribute", () => {
    expectNoOffenses('<a href="<%= user.home_page_url %>">My Link</a>')
  })

  test("ignores non-a tags", () => {
    expectNoOffenses("<div>My div</div>")
  })

  test("handles mixed case a tags", () => {
    expectError("Add an `href` attribute to `<a>` to ensure it is focusable and accessible.")

    assertOffenses("<A>My link</A>")
  })
})
