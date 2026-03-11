import { describe, test } from "vitest"
import { HTMLAnchorRequireHrefRule } from "../../src/rules/html-anchor-require-href.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(HTMLAnchorRequireHrefRule)

const MISSING_HREF_MESSAGE = "Add an `href` attribute to `<a>` to ensure it is focusable and accessible. Links should navigate somewhere. If you need a clickable element without navigation, use a `<button>` instead."
const HASH_HREF_MESSAGE = 'Avoid `href="#"` on `<a>`. `href="#"` does not navigate anywhere, scrolls the page to the top, and adds `#` to the URL. If you need a clickable element without navigation, use a `<button>` instead.'
const NIL_HREF_MESSAGE = "Avoid passing `nil` as the URL for `link_to`. Links should navigate somewhere. If you need a clickable element without navigation, use a `<button>` instead."

describe("html-anchor-require-href", () => {
  test("passes for a with href attribute", () => {
    expectNoOffenses('<a href="http://example.com">My link</a>')
  })

  test("fails for a without href attribute", () => {
    expectError(MISSING_HREF_MESSAGE)

    assertOffenses("<a>My link</a>")
  })

  test("fails for multiple a tags without href", () => {
    expectError(MISSING_HREF_MESSAGE)
    expectError(MISSING_HREF_MESSAGE)

    assertOffenses("<a>My link</a><a>My other link</a>")
  })

  test("fails for a with href='#'", () => {
    expectError(HASH_HREF_MESSAGE)

    assertOffenses('<a href="#">My link</a>')
  })

  test("fails for a with name attribute and no href", () => {
    expectError(MISSING_HREF_MESSAGE)

    assertOffenses('<a name="section1"></a>')
  })

  test("fails for a with id attribute and no href", () => {
    expectError(MISSING_HREF_MESSAGE)

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
    expectError(MISSING_HREF_MESSAGE)

    assertOffenses('<a class="btn">My link</a>')
  })

  test("fails for a with href='#' and other attributes", () => {
    expectError(HASH_HREF_MESSAGE)

    assertOffenses('<a href="#" data-action="click->doSomething">My link</a>')
  })

  test("ignores non-a tags", () => {
    expectNoOffenses("<div>My div</div>")
  })

  test("handles mixed case a tags", () => {
    expectError(MISSING_HREF_MESSAGE)

    assertOffenses("<A>My link</A>")
  })

  test("fails for link_to with href='#'", () => {
    expectError(HASH_HREF_MESSAGE)

    assertOffenses('<%= link_to "Click me", "#" %>')
  })

  test("fails for link_to with href='#' and html options", () => {
    expectError(HASH_HREF_MESSAGE)

    assertOffenses('<%= link_to "Click me", "#", class: "example" %>')
  })

  test("fails for link_to with href='#' block form", () => {
    expectError(HASH_HREF_MESSAGE)

    assertOffenses('<%= link_to "#" do %>Click me<% end %>')
  })

  test("passes for link_to with path helper", () => {
    expectNoOffenses('<%= link_to "Click me", root_path %>')
  })

  test("passes for link_to with string url", () => {
    expectNoOffenses('<%= link_to "Click me", "http://example.com" %>')
  })

  test("fails for link_to with nil url", () => {
    expectError(NIL_HREF_MESSAGE)

    assertOffenses('<%= link_to "Profile", nil %>')
  })

  test("fails for link_to with nil url and html options", () => {
    expectError(NIL_HREF_MESSAGE)

    assertOffenses('<%= link_to "Profile", nil, class: "btn" %>')
  })
})
