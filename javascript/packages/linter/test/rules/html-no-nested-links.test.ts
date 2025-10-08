import { describe, test } from "vitest"
import { HTMLNoNestedLinksRule } from "../../src/rules/html-no-nested-links.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(HTMLNoNestedLinksRule)

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
    expectNoOffenses(`<%= link_to "Products", products_path do %><%= link_to "Special offer", offer_path %><% end %>`)
  })
})
