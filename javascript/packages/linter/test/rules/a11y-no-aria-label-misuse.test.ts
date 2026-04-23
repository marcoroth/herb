import { describe, test } from "vitest"
import { A11yNoAriaLabelMisuseRule } from "../../src/rules/a11y-no-aria-label-misuse.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectWarning, assertOffenses } = createLinterTest(A11yNoAriaLabelMisuseRule)

const MESSAGE =
  "`aria-label` and `aria-labelledby` usage are only reliably supported on interactive elements and a subset of ARIA roles."

describe("a11y-no-aria-label-misuse", () => {
  // Correct usage: interactive elements
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

  // Correct usage: elements without aria-label
  test("passes for span without aria-label", () => {
    expectNoOffenses("<span>Hello</span>")
  })

  test("passes for div without aria-label", () => {
    expectNoOffenses("<div>Goodbye</div>")
  })

  test("passes for h1 without aria-label", () => {
    expectNoOffenses("<h1>Page title</h1>")
  })

  // Correct usage: generic elements with permitted role
  test("passes for div with role=dialog and aria-labelledby", () => {
    expectNoOffenses('<div role="dialog" aria-labelledby="dialogHeading"><h1 id="dialogHeading">Heading</h1></div>')
  })

  test("passes for span with role=button and aria-label", () => {
    expectNoOffenses('<span role="button" aria-label="Close">X</span>')
  })

  test("passes for div with role=alert and aria-label", () => {
    expectNoOffenses('<div role="alert" aria-label="Warning">Warning message</div>')
  })

  // Incorrect usage: name-restricted elements
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

  // Incorrect usage: generic elements without role
  test("fails for span with aria-label and no role", () => {
    expectWarning(MESSAGE)
    assertOffenses('<span aria-label="Tooltip">Text</span>')
  })

  test("fails for div with aria-labelledby and no role", () => {
    expectWarning(MESSAGE)
    assertOffenses('<div aria-labelledby="heading1">Content</div>')
  })

  // Incorrect usage: generic elements with prohibited role
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
})
