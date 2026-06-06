import { describe, test } from "vitest"
import { A11yNoAriaLabelMisuseRule } from "../../src/rules/a11y-no-aria-label-misuse.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectWarning, assertOffenses } = createLinterTest(A11yNoAriaLabelMisuseRule)

const MESSAGE = "`aria-label` and `aria-labelledby` usage are only reliably supported on interactive elements and a subset of ARIA roles."

describe("a11y-no-aria-label-misuse", () => {
  test("passes for button with aria-label", () => {
    expectNoOffenses('<button aria-label="Close"><svg></svg></button>')
  })

  test("passes for a with aria-label", () => {
    expectNoOffenses('<a href="/about" aria-label="About us">About</a>')
  })

  test("passes for input with aria-label", () => {
    expectNoOffenses('<input aria-label="Search" type="text" />')
  })

  test("passes for select with aria-labelledby", () => {
    expectNoOffenses('<select aria-labelledby="label1"><option>A</option></select>')
  })

  test("passes for textarea with aria-label", () => {
    expectNoOffenses('<textarea aria-label="Message"></textarea>')
  })

  test("passes for span without aria-label", () => {
    expectNoOffenses("<span>Hello</span>")
  })

  test("passes for div without aria-label", () => {
    expectNoOffenses("<div>Goodbye</div>")
  })

  test("passes for h1 without aria-label", () => {
    expectNoOffenses("<h1>Page title</h1>")
  })

  test("passes for div with role=dialog and aria-labelledby", () => {
    expectNoOffenses('<div role="dialog" aria-labelledby="dialogHeading"><h1 id="dialogHeading">Heading</h1></div>')
  })

  test("passes for span with role=button and aria-label", () => {
    expectNoOffenses('<span role="button" aria-label="Close">X</span>')
  })

  test("passes for div with role=alert and aria-label", () => {
    expectNoOffenses('<div role="alert" aria-label="Warning">Warning message</div>')
  })

  test("fails for h1 with aria-label", () => {
    expectWarning(MESSAGE)
    assertOffenses('<h1 aria-label="Override">Page title</h1>')
  })

  test("fails for h2 with aria-label", () => {
    expectWarning(MESSAGE)
    assertOffenses('<h2 aria-label="Override">Section</h2>')
  })

  test("fails for h3 with aria-labelledby", () => {
    expectWarning(MESSAGE)
    assertOffenses('<h3 aria-labelledby="ref">Heading</h3>')
  })

  test("fails for h4 with aria-label", () => {
    expectWarning(MESSAGE)
    assertOffenses('<h4 aria-label="Override">Heading</h4>')
  })

  test("fails for h5 with aria-label", () => {
    expectWarning(MESSAGE)
    assertOffenses('<h5 aria-label="Override">Heading</h5>')
  })

  test("fails for h6 with aria-label", () => {
    expectWarning(MESSAGE)
    assertOffenses('<h6 aria-label="Override">Heading</h6>')
  })

  test("fails for strong with aria-label", () => {
    expectWarning(MESSAGE)
    assertOffenses('<strong aria-label="Override">Bold text</strong>')
  })

  test("fails for i with aria-label", () => {
    expectWarning(MESSAGE)
    assertOffenses('<i aria-label="Override">Italic text</i>')
  })

  test("fails for p with aria-label", () => {
    expectWarning(MESSAGE)
    assertOffenses('<p aria-label="Override">Paragraph</p>')
  })

  test("fails for b with aria-label", () => {
    expectWarning(MESSAGE)
    assertOffenses('<b aria-label="Override">Bold</b>')
  })

  test("fails for code with aria-label", () => {
    expectWarning(MESSAGE)
    assertOffenses('<code aria-label="Override">Code</code>')
  })

  test("fails for span with aria-label and no role", () => {
    expectWarning(MESSAGE)
    assertOffenses('<span aria-label="Tooltip">Text</span>')
  })

  test("fails for div with aria-labelledby and no role", () => {
    expectWarning(MESSAGE)
    assertOffenses('<div aria-labelledby="heading1">Content</div>')
  })

  test("fails for div with role=none and aria-label", () => {
    expectWarning(MESSAGE)
    assertOffenses('<div role="none" aria-label="Hidden">Content</div>')
  })

  test("fails for span with role=presentation and aria-label", () => {
    expectWarning(MESSAGE)
    assertOffenses('<span role="presentation" aria-label="Hidden">Content</span>')
  })

  test("fails for div with role=paragraph and aria-label", () => {
    expectWarning(MESSAGE)
    assertOffenses('<div role="paragraph" aria-label="Override">Content</div>')
  })

  test("fails for p with aria-labelledby", () => {
    expectWarning(MESSAGE)
    assertOffenses('<p aria-labelledby="ref">Paragraph</p>')
  })

  test("fails for span with aria-labelledby and no role", () => {
    expectWarning(MESSAGE)
    assertOffenses('<span aria-labelledby="ref">Text</span>')
  })

  test("passes for div with dynamic role and aria-label", () => {
    expectNoOffenses('<div role="<%= role %>" aria-label="Label">Content</div>')
  })

  test("passes for nav with aria-label", () => {
    expectNoOffenses('<nav aria-label="Main navigation"><a href="/">Home</a></nav>')
  })

  test("passes for section with aria-labelledby", () => {
    expectNoOffenses('<section aria-labelledby="heading"><h2 id="heading">Title</h2></section>')
  })

  test("passes for form with aria-label", () => {
    expectNoOffenses('<form aria-label="Search form"><input type="text" /></form>')
  })

  test("passes for img with aria-label", () => {
    expectNoOffenses('<img aria-label="Logo" src="logo.png" />')
  })

  test("fails for tag.h1 with aria-label", () => {
    expectWarning(MESSAGE)
    assertOffenses('<%= tag.h1 aria_label: "Override" %>')
  })

  test("fails for tag.span with aria-label and no role", () => {
    expectWarning(MESSAGE)
    assertOffenses('<%= tag.span aria_label: "Tooltip" %>')
  })

  test("passes for tag.div with permitted role and aria-label", () => {
    expectNoOffenses('<%= tag.div role: "dialog", aria_label: "Modal" %>')
  })

  test("passes for tag.button with aria-label", () => {
    expectNoOffenses('<%= tag.button aria_label: "Close" %>')
  })

  test("fails for div with role=generic and aria-label", () => {
    expectWarning(MESSAGE)
    assertOffenses('<div role="generic" aria-label="Label">Content</div>')
  })

  test("fails for span with role=tooltip and aria-label", () => {
    expectWarning(MESSAGE)
    assertOffenses('<span role="tooltip" aria-label="Hint">Content</span>')
  })

  test("passes for span with role=img and aria-label", () => {
    expectNoOffenses('<span role="img" aria-label="Warning"></span>')
  })

  test("reports offense for both aria-label and aria-labelledby on same element", () => {
    expectWarning(MESSAGE)
    assertOffenses('<span aria-label="Tooltip" aria-labelledby="tooltip-label"></span>')
  })

  test("fails for hard-banned element even with dynamic role", () => {
    expectWarning(MESSAGE)
    assertOffenses('<p role="<%= role_name %>" aria-label="Description">Text</p>')
  })

  test("fails for em with aria-label", () => {
    expectWarning(MESSAGE)
    assertOffenses('<em aria-label="Override">Emphasis text</em>')
  })
})
