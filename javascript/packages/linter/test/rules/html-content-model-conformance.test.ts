import { describe, test } from "vitest"
import { HTMLContentModelConformanceRule } from "../../src/rules/html-content-model-conformance.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(
  HTMLContentModelConformanceRule,
)

describe("html-content-model-conformance", () => {
  test("passes for phrasing elements containing other phrasing elements", () => {
    expectNoOffenses(`<span>Hello <strong>World</strong></span>`)
  })

  test("passes for flow elements containing flow elements", () => {
    expectNoOffenses(`<div><p>Paragraph inside div (valid)</p></div>`)
  })

  test("fails for div inside span", () => {
    expectError("Element `<div>` cannot be placed inside element `<span>`.")
    assertOffenses(`<span><div>Invalid flow content inside span</div></span>`)
  })

  test("fails for paragraph inside span", () => {
    expectError("Element `<p>` cannot be placed inside element `<span>`.")
    assertOffenses(`<span><p>Paragraph inside span (invalid)</p></span>`)
  })

  test("fails for multiple flow elements inside phrasing", () => {
    expectError("Element `<div>` cannot be placed inside element `<span>`.")
    expectError("Element `<p>` cannot be placed inside element `<span>`.")
    assertOffenses(`<span><div>First</div><p>Second</p></span>`)
  })

  test("fails for flow inside anchor tag with span parent", () => {
    expectError("Element `<div>` cannot be placed inside element `<a>`.")
    assertOffenses(`<span><a href="#"><div>Link with div</div></a></span>`)
  })

  test("passes for flow inside anchor tag with div parent", () => {
    expectNoOffenses(`<div><a href="#"><div>Link with div</div></a></div>`)
  })

  test("passes for flow inside anchor tag with no parent", () => {
    expectNoOffenses(`<a href="#"><div>Link with div</div></a>`)
  })

  test("fails for heading inside strong", () => {
    expectError("Element `<h1>` cannot be placed inside element `<strong>`.")
    assertOffenses(`<strong><h1>Heading in strong</h1></strong>`)
  })

  test("fails for section inside em", () => {
    expectError("Element `<section>` cannot be placed inside element `<em>`.")
    assertOffenses(`<em><section>Section in em</section></em>`)
  })

  test("passes for nested phrasing elements", () => {
    expectNoOffenses(
      `<span><a href="#"><em><strong>Valid nesting</strong></em></a></span>`,
    )
  })

  test("fails for deeply nested flow in inline", () => {
    expectError("Element `<div>` cannot be placed inside element `<strong>`.")
    assertOffenses(
      `<span><em><strong><div>Deeply nested div</div></strong></em></span>`,
    )
  })

  test("passes for phrasing elements with text and phrasing children", () => {
    expectNoOffenses(`<span>Text before <code>code</code> text after</span>`)
  })

  test("passes for list inside flow element", () => {
    expectNoOffenses(`<div><ul><li>Item</li></ul></div>`)
  })

  test("fails for list inside phrasing element", () => {
    expectError("Element `<ul>` cannot be placed inside element `<span>`.")
    assertOffenses(`<span><ul><li>Item</li></ul></span>`)
  })

  test("handles ERB templates correctly", () => {
    expectNoOffenses(`<span><%= render partial: "some/partial" %></span>`)
  })

  test("fails for form inside button", () => {
    expectError("Element `<form>` cannot be placed inside element `<button>`.")
    assertOffenses(`<button><form action="/submit">Submit</form></button>`)
  })

  test("fails for table inside label", () => {
    expectError("Element `<table>` cannot be placed inside element `<label>`.")
    assertOffenses(`<label><table><tr><td>Cell</td></tr></table></label>`)
  })

  test("passes for custom elements inside phrasing elements", () => {
    expectNoOffenses(`<span><my-component>Custom content</my-component></span>`)
  })

  test("passes for flow elements inside custom elements", () => {
    expectNoOffenses(
      `<my-inline-component><div>Flow inside custom</div></my-inline-component>`,
    )
  })

  test("passes for custom elements with various naming patterns inside phrasing", () => {
    expectNoOffenses(`
      <span>
        <x-button>Click me</x-button>
        <app-icon></app-icon>
        <my-very-long-component-name>Content</my-very-long-component-name>
      </span>
    `)
  })

  test("still fails for standard flow elements after custom elements", () => {
    expectError("Element `<div>` cannot be placed inside element `<span>`.")
    assertOffenses(
      `<span><my-component>Custom</my-component><div>Flow div</div></span>`,
    )
  })

  test("passes for nested custom elements inside phrasing", () => {
    expectNoOffenses(
      `<span><outer-component><inner-component><div>Content</div></inner-component></outer-component></span>`,
    )
  })

  test("passes for single-word custom elements inside phrasing", () => {
    expectNoOffenses(
      `<span><customtag><div>Flow inside unknown element</div></customtag></span>`,
    )
  })

  test("passes for unknown elements inside phrasing but allows content inside unknown elements", () => {
    expectNoOffenses(
      `<span><unknownelement><randomtag><div>Flow content</div></randomtag></unknownelement></span>`,
    )
  })

  test("passes for custom elements at top level", () => {
    expectNoOffenses(
      `<my-component><div>Flow inside custom</div></my-component>`,
    )
  })

  test("fails for phrasing element containg erb node containing flow node", () => {
    expectError("Element `<div>` cannot be placed inside element `<span>`.")
    assertOffenses(`<span><% if true %><div>Not allowed</div><% end %></span>`)
  })

  test("passes for dt and dd elements inside div with dl parent", () => {
    expectNoOffenses(`<dl><div><dt>dt</dt><dd>dd</dd></div></dl>`)
  })

  test("fails for p element inside div with dl parent", () => {
    expectError("Element `<p>` cannot be placed inside element `<div>`.")
    assertOffenses(`<dl><div><p>invalid</p></div></dl>`)
  })

  test("passes for span element inside div with option ancestor", () => {
    expectNoOffenses(
      `<select><option><div><span>valid</span></div></option></select>`,
    )
  })

  test("fails for p element inside div with option ancestor", () => {
    expectError("Element `<p>` cannot be placed inside element `<div>`.")
    assertOffenses(`<select><option><div><p>valid</p></div></option></select>`)
  })

  test("passes for div element inside div with optgroup ancestor", () => {
    expectNoOffenses(
      `<select><optgroup><div><div><option>invalid</option></div></div></optgroup></select>`,
    )
  })

  test("fails for span element inside div with optgroup ancestor", () => {
    expectError("Element `<span>` cannot be placed inside element `<div>`.")
    assertOffenses(
      `<select><optgroup><div><span>invalid</span></div></optgroup></select>`,
    )
  })

  test("passes for div element inside div with select ancestor", () => {
    expectNoOffenses(
      `<select><div><div><option>invalid</option></div></div></select>`,
    )
  })

  test("fails for span element inside div with select ancestor", () => {
    expectError("Element `<span>` cannot be placed inside element `<div>`.")
    assertOffenses(`<select><div><span>invalid</span></div></select>`)
  })
})
