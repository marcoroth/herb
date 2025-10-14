import { describe, test } from "vitest"
import { HTMLNoBlockInsideInlineRule } from "../../src/rules/html-no-block-inside-inline.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(HTMLNoBlockInsideInlineRule)

describe("html-no-block-inside-inline", () => {
  test("passes for inline elements containing other inline elements", () => {
    expectNoOffenses(`<span>Hello <strong>World</strong></span>`)
  })

  test("passes for block elements containing block elements", () => {
    expectNoOffenses(`<div><p>Paragraph inside div (valid)</p></div>`)
  })

  test("fails for div inside span", () => {
    expectError('Block-level element `<div>` cannot be placed inside inline element `<span>`.')
    assertOffenses(`<span><div>Invalid block inside span</div></span>`)
  })

  test("fails for paragraph inside span", () => {
    expectError('Block-level element `<p>` cannot be placed inside inline element `<span>`.')
    assertOffenses(`<span><p>Paragraph inside span (invalid)</p></span>`)
  })

  test("fails for multiple block elements inside inline", () => {
    expectError('Block-level element `<div>` cannot be placed inside inline element `<span>`.')
    expectError('Block-level element `<p>` cannot be placed inside inline element `<span>`.')
    assertOffenses(`<span><div>First</div><p>Second</p></span>`)
  })

  test("fails for block inside anchor tag", () => {
    expectError('Block-level element `<div>` cannot be placed inside inline element `<a>`.')
    assertOffenses(`<a href="#"><div>Link with div</div></a>`)
  })

  test("fails for heading inside strong", () => {
    expectError('Block-level element `<h1>` cannot be placed inside inline element `<strong>`.')
    assertOffenses(`<strong><h1>Heading in strong</h1></strong>`)
  })

  test("fails for section inside em", () => {
    expectError('Block-level element `<section>` cannot be placed inside inline element `<em>`.')
    assertOffenses(`<em><section>Section in em</section></em>`)
  })

  test("passes for nested inline elements", () => {
    expectNoOffenses(`<span><a href="#"><em><strong>Valid nesting</strong></em></a></span>`)
  })

  test("fails for deeply nested block in inline", () => {
    expectError('Block-level element `<div>` cannot be placed inside inline element `<strong>`.')
    assertOffenses(`<span><em><strong><div>Deeply nested div</div></strong></em></span>`)
  })

  test("passes for inline elements with text and inline children", () => {
    expectNoOffenses(`<span>Text before <code>code</code> text after</span>`)
  })

  test("fails for list inside inline element", () => {
    expectError('Block-level element `<ul>` cannot be placed inside inline element `<span>`.')
    assertOffenses(`<span><ul><li>Item</li></ul></span>`)
  })

  test("handles ERB templates correctly", () => {
    expectNoOffenses(`<span><%= render partial: "some/partial" %></span>`)
  })

  test("fails for form inside button", () => {
    expectError('Block-level element `<form>` cannot be placed inside inline element `<button>`.')
    assertOffenses(`<button><form action="/submit">Submit</form></button>`)
  })

  test("fails for table inside label", () => {
    expectError('Block-level element `<table>` cannot be placed inside inline element `<label>`.')
    assertOffenses(`<label><table><tr><td>Cell</td></tr></table></label>`)
  })

  test("fails for custom elements inside inline elements", () => {
    expectError('Unknown element `<my-component>` cannot be placed inside inline element `<span>`.')
    assertOffenses(`<span><my-component>Custom content</my-component></span>`)
  })

  test("passes for block elements inside custom elements", () => {
    expectNoOffenses(`<my-inline-component><div>Block inside custom</div></my-inline-component>`)
  })

  test("fails for custom elements with various naming patterns inside inline", () => {
    expectError('Unknown element `<x-button>` cannot be placed inside inline element `<span>`.')
    expectError('Unknown element `<app-icon>` cannot be placed inside inline element `<span>`.')
    expectError('Unknown element `<my-very-long-component-name>` cannot be placed inside inline element `<span>`.')
    assertOffenses(`
      <span>
        <x-button>Click me</x-button>
        <app-icon></app-icon>
        <my-very-long-component-name>Content</my-very-long-component-name>
      </span>
    `)
  })

  test("still fails for standard block elements after custom elements", () => {
    expectError('Unknown element `<my-component>` cannot be placed inside inline element `<span>`.')
    expectError('Block-level element `<div>` cannot be placed inside inline element `<span>`.')
    assertOffenses(`<span><my-component>Custom</my-component><div>Block div</div></span>`)
  })

  test("fails for nested custom elements inside inline", () => {
    expectError('Unknown element `<outer-component>` cannot be placed inside inline element `<span>`.')
    assertOffenses(`<span><outer-component><inner-component><div>Content</div></inner-component></outer-component></span>`)
  })

  test("fails for single-word custom elements inside inline", () => {
    expectError('Unknown element `<customtag>` cannot be placed inside inline element `<span>`.')
    assertOffenses(`<span><customtag><div>Block inside unknown element</div></customtag></span>`)
  })

  test("fails for unknown elements inside inline but allows content inside unknown elements", () => {
    expectError('Unknown element `<unknownelement>` cannot be placed inside inline element `<span>`.')
    assertOffenses(`<span><unknownelement><randomtag><div>Block content</div></randomtag></unknownelement></span>`)
  })

  test("passes for custom elements at top level", () => {
    expectNoOffenses(`<my-component><div>Block inside custom</div></my-component>`)
  })

  test("fails for inline element containg erb node containing block node", () => {
    expectError('Block-level element `<div>` cannot be placed inside inline element `<span>`.')
    assertOffenses(`<span><% if true %><div>Not allowed</div><% end %></span>`)
  })
})
