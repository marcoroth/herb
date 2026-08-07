import { describe, test } from "vitest"
import { A11ySVGHasAccessibleTextRule } from "../../src/rules/a11y-svg-has-accessible-text.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectWarning, assertOffenses } = createLinterTest(A11ySVGHasAccessibleTextRule)

const offenseMessage = '`<svg>` must have accessible text. Set `aria-label`, or `aria-labelledby`, or nest a `<title>` element. If the `<svg>` is decorative, hide it with `aria-hidden="true"`.'

describe("a11y-svg-has-accessible-text", () => {
  test("passes for svg with aria-label", () => {
    expectNoOffenses('<svg aria-label="A circle" height="100" width="100"><circle cx="50" cy="50" r="40" /></svg>')
  })

  test("passes for svg with aria-labelledby", () => {
    expectNoOffenses('<svg aria-labelledby="circle_title" height="100" width="100"><circle cx="50" cy="50" r="40" /></svg>')
  })

  test("passes for svg with nested title element", () => {
    expectNoOffenses('<svg height="100" width="100"><title>A circle</title><circle cx="50" cy="50" r="40" /></svg>')
  })

  test("passes for svg with aria-hidden=true", () => {
    expectNoOffenses('<svg aria-hidden="true" height="100" width="100"><circle cx="50" cy="50" r="40" /></svg>')
  })

  test("fails for svg without accessible text", () => {
    expectWarning(offenseMessage)
    assertOffenses('<svg height="100" width="100"><circle cx="50" cy="50" r="40" /></svg>')
  })

  test("fails for empty svg without accessible text", () => {
    expectWarning(offenseMessage)
    assertOffenses('<svg></svg>')
  })

  test("fails for svg with aria-hidden=false", () => {
    expectWarning(offenseMessage)
    assertOffenses('<svg aria-hidden="false" height="100" width="100"><circle cx="50" cy="50" r="40" /></svg>')
  })

  test("ignores non-svg elements", () => {
    expectNoOffenses('<div height="100" width="100"></div>')
  })

  test("fails for multiple svg elements without accessible text", () => {
    expectWarning(offenseMessage)
    expectWarning(offenseMessage)
    assertOffenses('<svg></svg><svg></svg>')
  })

  test("passes for svg with both aria-label and title", () => {
    expectNoOffenses('<svg aria-label="A circle"><title>A circle</title></svg>')
  })

  test("passes for svg with dynamic aria-label", () => {
    expectNoOffenses('<svg aria-label="<%= label %>"><path d="..." /></svg>')
  })

  test("passes for svg with dynamic aria-labelledby", () => {
    expectNoOffenses('<svg aria-labelledby="<%= id %>"><path d="..." /></svg>')
  })

  test("passes for svg with dynamic aria-hidden=true", () => {
    expectNoOffenses('<svg aria-hidden="<%= hidden %>"><path d="..." /></svg>')
  })

  test("passes for svg with ERB title child", () => {
    expectNoOffenses('<svg><title><%= title_text %></title><path d="..." /></svg>')
  })

  test("fails for title nested inside a group", () => {
    expectWarning(offenseMessage)
    assertOffenses('<svg><g><title>Nested title</title></g></svg>')
  })

  test("passes for svg with aria-hidden boolean attribute", () => {
    expectNoOffenses('<svg aria-hidden><path d="..." /></svg>')
  })

  test("fails for tag.svg without accessible text", () => {
    expectWarning(offenseMessage)
    assertOffenses('<%= tag.svg %>')
  })

  test("passes for tag.svg with aria-label", () => {
    expectNoOffenses('<%= tag.svg aria_label: "Icon" %>')
  })

  test("passes for tag.svg with aria-hidden", () => {
    expectNoOffenses('<%= tag.svg aria_hidden: true %>')
  })

  test("fails for content_tag :svg without accessible text", () => {
    expectWarning(offenseMessage)
    assertOffenses('<%= content_tag :svg %>')
  })

  test("passes for content_tag :svg with aria-label", () => {
    expectNoOffenses('<%= content_tag :svg, nil, "aria-label": "Icon" %>')
  })

  test("passes for tag.svg with tag.title child", () => {
    expectNoOffenses('<%= tag.svg do %><%= tag.title "Icon" %><% end %>')
  })

  test("fails for tag.svg with tag.title nested in tag.g", () => {
    expectWarning(offenseMessage)
    assertOffenses('<%= tag.svg do %><%= tag.g do %><%= tag.title "Icon" %><% end %><% end %>')
  })
})
