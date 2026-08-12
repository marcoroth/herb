import { describe, test } from "vitest"
import { HTMLNoNestedLinksRule } from "../../src/rules/html-no-nested-links.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"
import { renderedFrom, renderedFromNowhere } from "../helpers/partial-caller-context.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(HTMLNoNestedLinksRule)

const PARTIAL = "app/views/shared/_link_body.html.erb"

describe("html-no-nested-links", () => {
  test("passes for separate links", () => {
    expectNoOffenses(`<a href="/products">View products</a><a href="/about">About us</a>`)
  })

  test("fails for directly nested links", () => {
    expectError("Nested `<a>` elements are not allowed. Links cannot contain other links.")
    assertOffenses(`<a href="/products">View <a href="/special-offer">special offer</a></a>`)
  })

  test("fails for indirectly nested links", () => {
    expectError("Nested `<a>` elements are not allowed. Links cannot contain other links.")
    assertOffenses(`<a href="/main"><div><span><a href="/nested">Nested link</a></span></div></a>`)
  })

  test("passes for links in different containers", () => {
    expectNoOffenses(`<div><a href="/products">Products</a></div><div><a href="/special-offer">Special offer</a></div>`)
  })

  test("fails for multiple levels of nesting", () => {
    expectError("Nested `<a>` elements are not allowed. Links cannot contain other links.")
    expectError("Nested `<a>` elements are not allowed. Links cannot contain other links.")
    assertOffenses(`<a href="/level1"><a href="/level2"><a href="/level3">Deep nesting</a></a></a>`)
  })

  test("handles mixed case anchor tags", () => {
    expectError("Nested `<a>` elements are not allowed. Links cannot contain other links.")
    assertOffenses(`<a href="/main"><A href="/nested">Nested</A></a>`)
  })

  test("passes for links with complex content", () => {
    expectNoOffenses(`<a href="/profile"><img src="/avatar.jpg" alt="Avatar"><span>User Name</span></a>`)
  })

  test("handles ERB templates with links", () => {
    expectNoOffenses(`<div><% items.each do |item| %><a href="<%= item.url %>"><%= item.name %></a><% end %></div>`)
  })

  test("fails for nested links in ERB", () => {
    expectError("Nested `<a>` elements are not allowed. Links cannot contain other links.")

    assertOffenses(`<%= link_to "Products", products_path do %><%= link_to "Special offer", offer_path %><% end %>`)
  })

  test("fails for a plain link inside a link_to block", () => {
    expectError("Nested `<a>` elements are not allowed. Links cannot contain other links.")

    assertOffenses(`<%= link_to "/outer" do %><a href="/inner">Inner</a><% end %>`)
  })

  test("fails for a link_to inside a plain link", () => {
    expectError("Nested `<a>` elements are not allowed. Links cannot contain other links.")

    assertOffenses(`<a href="/outer"><%= link_to "Inner", "/x" %></a>`)
  })

  test("passes for sibling link_to calls", () => {
    expectNoOffenses(`<%= link_to "One", one_path %><%= link_to "Two", two_path %>`)
  })

  describe("across call sites", () => {
    test("fails when every call site renders the file inside a link", () => {
      expectError("Nested `<a>` elements are not allowed. Every call site renders this file inside an `<a>` element.")

      assertOffenses(`<a href="/inner">Inner</a>`, renderedFrom(PARTIAL, ["html", "body", "a"]))
    })

    test("fails when only some call sites render the file inside a link", () => {
      expectError("Nested `<a>` elements are not allowed. At least one call site renders this file inside an `<a>` element.")

      assertOffenses(`<a href="/inner">Inner</a>`, renderedFrom(PARTIAL, ["html", "body", "a"], ["html", "body", "div"]))
    })

    test("passes when no call site renders the file inside a link", () => {
      expectNoOffenses(`<a href="/inner">Inner</a>`, renderedFrom(PARTIAL, ["html", "body", "div"]))
    })

    test("passes when nothing renders the file", () => {
      expectNoOffenses(`<a href="/inner">Inner</a>`, renderedFromNowhere(PARTIAL))
    })

    test("reports the outer link against the callers and the inner one against the outer", () => {
      expectError("Nested `<a>` elements are not allowed. Every call site renders this file inside an `<a>` element.")
      expectError("Nested `<a>` elements are not allowed. Links cannot contain other links.")

      assertOffenses(`<a href="/outer"><a href="/inner">Inner</a></a>`, renderedFrom(PARTIAL, ["html", "body", "a"]))
    })

    test("does not report the same element against both the local stack and the callers", () => {
      expectError("Nested `<a>` elements are not allowed. Links cannot contain other links.")

      assertOffenses(`<div><a href="/outer"><a href="/inner">Inner</a></a></div>`, renderedFrom(PARTIAL, ["html", "body", "div"]))
    })
  })
})
