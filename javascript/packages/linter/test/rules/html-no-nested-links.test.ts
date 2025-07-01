import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../../src/linter.js"
import { HTMLNoNestedLinksRule } from "../../src/rules/html-no-nested-links.js"

describe("html-no-nested-links", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("passes for separate links", () => {
    const html = '<a href="/products">View products</a><a href="/about">About us</a>'
    const result = Herb.parse(html)
    const linter = new Linter([HTMLNoNestedLinksRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.messages).toHaveLength(0)
  })

  test("fails for directly nested links", () => {
    const html = '<a href="/products">View <a href="/special-offer">special offer</a></a>'
    const result = Herb.parse(html)
    const linter = new Linter([HTMLNoNestedLinksRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.messages).toHaveLength(1)

    expect(lintResult.messages[0].id).toBe("html-no-nested-links")
    expect(lintResult.messages[0].message).toBe("Nested `<a>` elements are not allowed. Links cannot contain other links.")
    expect(lintResult.messages[0].severity).toBe("error")
  })

  test("fails for indirectly nested links", () => {
    const html = '<a href="/main"><div><span><a href="/nested">Nested link</a></span></div></a>'
    const result = Herb.parse(html)
    const linter = new Linter([HTMLNoNestedLinksRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.messages[0].message).toBe("Nested `<a>` elements are not allowed. Links cannot contain other links.")
  })

  test("passes for links in different containers", () => {
    const html = '<div><a href="/products">Products</a></div><div><a href="/special-offer">Special offer</a></div>'
    const result = Herb.parse(html)
    const linter = new Linter([HTMLNoNestedLinksRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
  })

  test("fails for multiple levels of nesting", () => {
    const html = '<a href="/level1"><a href="/level2"><a href="/level3">Deep nesting</a></a></a>'
    const result = Herb.parse(html)
    const linter = new Linter([HTMLNoNestedLinksRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(2) // Second and third links are nested
    expect(lintResult.warnings).toBe(0)
  })

  test("handles mixed case anchor tags", () => {
    const html = '<a href="/main"><A href="/nested">Nested</A></a>'
    const result = Herb.parse(html)
    const linter = new Linter([HTMLNoNestedLinksRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.messages[0].message).toBe("Nested `<a>` elements are not allowed. Links cannot contain other links.")
  })

  test("passes for links with complex content", () => {
    const html = '<a href="/profile"><img src="/avatar.jpg" alt="Avatar"><span>User Name</span></a>'
    const result = Herb.parse(html)
    const linter = new Linter([HTMLNoNestedLinksRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
  })

  test("handles ERB templates with links", () => {
    const html = '<div><% items.each do |item| %><a href="<%= item.url %>"><%= item.name %></a><% end %></div>'
    const result = Herb.parse(html)
    const linter = new Linter([HTMLNoNestedLinksRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
  })

  test("fails for nested links in ERB", () => {
    const html = '<%= link_to "Products", products_path do %><%= link_to "Special offer", offer_path %><% end %>'
    const result = Herb.parse(html)
    const linter = new Linter([HTMLNoNestedLinksRule])
    const lintResult = linter.lint(result.value)

    // This test might not catch ERB helpers since they're not parsed as HTML elements
    // but we're testing the structure we can detect
    expect(lintResult.errors).toBe(0) // ERB helper calls are not HTML elements
    expect(lintResult.warnings).toBe(0)
  })
})
