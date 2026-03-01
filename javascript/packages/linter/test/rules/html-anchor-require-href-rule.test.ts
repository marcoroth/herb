import { describe, test } from "vitest"
import { HTMLAnchorRequireHrefRule } from "../../src/rules/html-anchor-require-href.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(HTMLAnchorRequireHrefRule)

const MESSAGE = "Add an `href` attribute to `<a>` to ensure it is focusable and accessible. Links should go somewhere, you probably want to use a `<button>` instead."

describe("html-anchor-require-href", () => {
  test("passes for a with href attribute", () => {
    expectNoOffenses('<a href="http://example.com">My link</a>')
  })

  test("fails for a without href attribute", () => {
    expectError(MESSAGE)

    assertOffenses("<a>My link</a>")
  })

  test("fails for multiple a tags without href", () => {
    expectError(MESSAGE)
    expectError(MESSAGE)

    assertOffenses("<a>My link</a><a>My other link</a>")
  })

  test("fails for a with href='#'", () => {
    expectError(MESSAGE)

    assertOffenses('<a href="#">My link</a>')
  })

  test("fails for a with name attribute and no href", () => {
    expectError(MESSAGE)

    assertOffenses('<a name="section1"></a>')
  })

  test("fails for a with id attribute and no href", () => {
    expectError(MESSAGE)

    assertOffenses('<a id="content">anchor target</a>')
  })

  test("passes for a with ERB href attribute", () => {
    expectNoOffenses('<a href="<%= user.home_page_url %>">My Link</a>')
  })

  test("passes for a with fragment href", () => {
    expectNoOffenses('<a href="#section">Jump to section</a>')
  })

  test("passes for a with empty href", () => {
    expectNoOffenses('<a href="">Self link</a>')
  })

  test("passes for a with both name and href", () => {
    expectNoOffenses('<a name="top" href="http://example.com">My link</a>')
  })

  test("fails for a with other attributes but no href", () => {
    expectError(MESSAGE)

    assertOffenses('<a class="btn">My link</a>')
  })

  test("fails for a with href='#' and other attributes", () => {
    expectError(MESSAGE)

    assertOffenses('<a href="#" data-action="click->doSomething">My link</a>')
  })

  test("ignores non-a tags", () => {
    expectNoOffenses("<div>My div</div>")
  })

  test("handles mixed case a tags", () => {
    expectError(MESSAGE)

    assertOffenses("<A>My link</A>")
  })
})
