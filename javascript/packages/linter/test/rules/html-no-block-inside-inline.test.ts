import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../../src/linter.js"
import { HTMLNoBlockInsideInlineRule } from "../../src/rules/html-no-block-inside-inline.js"

describe("html-no-block-inside-inline", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("passes for inline elements containing other inline elements", () => {
    const html = '<span>Hello <strong>World</strong></span>'
    const result = Herb.parse(html)
    const linter = new Linter([HTMLNoBlockInsideInlineRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.messages).toHaveLength(0)
  })

  test("passes for block elements containing block elements", () => {
    const html = '<div><p>Paragraph inside div (valid)</p></div>'
    const result = Herb.parse(html)
    const linter = new Linter([HTMLNoBlockInsideInlineRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.messages).toHaveLength(0)
  })

  test("fails for div inside span", () => {
    const html = '<span><div>Invalid block inside span</div></span>'
    const result = Herb.parse(html)
    const linter = new Linter([HTMLNoBlockInsideInlineRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.messages).toHaveLength(1)

    expect(lintResult.messages[0].rule).toBe("html-no-block-inside-inline")
    expect(lintResult.messages[0].message).toBe('Block-level element `<div>` cannot be placed inside inline element `<span>`.')
    expect(lintResult.messages[0].severity).toBe("error")
  })

  test("fails for paragraph inside span", () => {
    const html = '<span><p>Paragraph inside span (invalid)</p></span>'
    const result = Herb.parse(html)
    const linter = new Linter([HTMLNoBlockInsideInlineRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.messages).toHaveLength(1)

    expect(lintResult.messages[0].message).toBe('Block-level element `<p>` cannot be placed inside inline element `<span>`.')
  })

  test("fails for multiple block elements inside inline", () => {
    const html = '<span><div>First</div><p>Second</p></span>'
    const result = Herb.parse(html)
    const linter = new Linter([HTMLNoBlockInsideInlineRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(2)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.messages).toHaveLength(2)
  })

  test("fails for block inside anchor tag", () => {
    const html = '<a href="#"><div>Link with div</div></a>'
    const result = Herb.parse(html)
    const linter = new Linter([HTMLNoBlockInsideInlineRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.messages[0].message).toBe('Block-level element `<div>` cannot be placed inside inline element `<a>`.')
  })

  test("fails for heading inside strong", () => {
    const html = '<strong><h1>Heading in strong</h1></strong>'
    const result = Herb.parse(html)
    const linter = new Linter([HTMLNoBlockInsideInlineRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.messages[0].message).toBe('Block-level element `<h1>` cannot be placed inside inline element `<strong>`.')
  })

  test("fails for section inside em", () => {
    const html = '<em><section>Section in em</section></em>'
    const result = Herb.parse(html)
    const linter = new Linter([HTMLNoBlockInsideInlineRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.messages[0].message).toBe('Block-level element `<section>` cannot be placed inside inline element `<em>`.')
  })

  test("passes for nested inline elements", () => {
    const html = '<span><a href="#"><em><strong>Valid nesting</strong></em></a></span>'
    const result = Herb.parse(html)
    const linter = new Linter([HTMLNoBlockInsideInlineRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
  })

  test("fails for deeply nested block in inline", () => {
    const html = '<span><em><strong><div>Deeply nested div</div></strong></em></span>'
    const result = Herb.parse(html)
    const linter = new Linter([HTMLNoBlockInsideInlineRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.messages[0].message).toBe('Block-level element `<div>` cannot be placed inside inline element `<strong>`.')
  })

  test("passes for inline elements with text and inline children", () => {
    const html = '<span>Text before <code>code</code> text after</span>'
    const result = Herb.parse(html)
    const linter = new Linter([HTMLNoBlockInsideInlineRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
  })

  test("fails for list inside inline element", () => {
    const html = '<span><ul><li>Item</li></ul></span>'
    const result = Herb.parse(html)
    const linter = new Linter([HTMLNoBlockInsideInlineRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.messages[0].message).toBe('Block-level element `<ul>` cannot be placed inside inline element `<span>`.')
  })

  test("handles ERB templates correctly", () => {
    const html = '<span><%= render partial: "some/partial" %></span>'
    const result = Herb.parse(html)
    const linter = new Linter([HTMLNoBlockInsideInlineRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
  })

  test("fails for form inside button", () => {
    const html = '<button><form action="/submit">Submit</form></button>'
    const result = Herb.parse(html)
    const linter = new Linter([HTMLNoBlockInsideInlineRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.messages[0].message).toBe('Block-level element `<form>` cannot be placed inside inline element `<button>`.')
  })

  test("fails for table inside label", () => {
    const html = '<label><table><tr><td>Cell</td></tr></table></label>'
    const result = Herb.parse(html)
    const linter = new Linter([HTMLNoBlockInsideInlineRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.messages[0].message).toBe('Block-level element `<table>` cannot be placed inside inline element `<label>`.')
  })

  test("fails for custom elements inside inline elements", () => {
    const html = '<span><my-component>Custom content</my-component></span>'
    const result = Herb.parse(html)
    const linter = new Linter([HTMLNoBlockInsideInlineRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.messages[0].message).toBe('Unknown element `<my-component>` cannot be placed inside inline element `<span>`.')
  })

  test("passes for block elements inside custom elements", () => {
    const html = '<my-inline-component><div>Block inside custom</div></my-inline-component>'
    const result = Herb.parse(html)
    const linter = new Linter([HTMLNoBlockInsideInlineRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
  })

  test("fails for custom elements with various naming patterns inside inline", () => {
    const html = `
      <span>
        <x-button>Click me</x-button>
        <app-icon></app-icon>
        <my-very-long-component-name>Content</my-very-long-component-name>
      </span>
    `
    const result = Herb.parse(html)
    const linter = new Linter([HTMLNoBlockInsideInlineRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(3)
    expect(lintResult.messages[0].message).toBe('Unknown element `<x-button>` cannot be placed inside inline element `<span>`.')
    expect(lintResult.messages[1].message).toBe('Unknown element `<app-icon>` cannot be placed inside inline element `<span>`.')
    expect(lintResult.messages[2].message).toBe('Unknown element `<my-very-long-component-name>` cannot be placed inside inline element `<span>`.')
  })

  test("still fails for standard block elements after custom elements", () => {
    const html = '<span><my-component>Custom</my-component><div>Block div</div></span>'
    const result = Herb.parse(html)
    const linter = new Linter([HTMLNoBlockInsideInlineRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(2)
    expect(lintResult.messages[0].message).toBe('Unknown element `<my-component>` cannot be placed inside inline element `<span>`.')
    expect(lintResult.messages[1].message).toBe('Block-level element `<div>` cannot be placed inside inline element `<span>`.')
  })

  test("fails for nested custom elements inside inline", () => {
    const html = '<span><outer-component><inner-component><div>Content</div></inner-component></outer-component></span>'
    const result = Herb.parse(html)
    const linter = new Linter([HTMLNoBlockInsideInlineRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.messages[0].message).toBe('Unknown element `<outer-component>` cannot be placed inside inline element `<span>`.')
  })

  test("fails for single-word custom elements inside inline", () => {
    const html = '<span><customtag><div>Block inside unknown element</div></customtag></span>'
    const result = Herb.parse(html)
    const linter = new Linter([HTMLNoBlockInsideInlineRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.messages[0].message).toBe('Unknown element `<customtag>` cannot be placed inside inline element `<span>`.')
  })

  test("fails for unknown elements inside inline but allows content inside unknown elements", () => {
    const html = '<span><unknownelement><randomtag><div>Block content</div></randomtag></unknownelement></span>'
    const result = Herb.parse(html)
    const linter = new Linter([HTMLNoBlockInsideInlineRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.messages[0].message).toBe('Unknown element `<unknownelement>` cannot be placed inside inline element `<span>`.')
  })

  test("passes for custom elements at top level", () => {
    const html = '<my-component><div>Block inside custom</div></my-component>'
    const result = Herb.parse(html)
    const linter = new Linter([HTMLNoBlockInsideInlineRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
  })

  test("fails for inline element containg erb node containing block node", () => {
    const html = '<span><% if true %><div>Not allowed</div><% end %></span>'
    const result = Herb.parse(html)
    const linter = new Linter([HTMLNoBlockInsideInlineRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.messages[0].message).toBe('Block-level element `<div>` cannot be placed inside inline element `<span>`.')
  })
})
