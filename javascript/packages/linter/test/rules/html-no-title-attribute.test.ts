import { describe, test } from "vitest"
import { HTMLNoTitleAttributeRule } from "../../src/rules/html-no-title-attribute.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(HTMLNoTitleAttributeRule)

describe("html-no-title-attribute", () => {
  test("passes for elements without title attribute", () => {
    expectNoOffenses('<button>Click me</button>')
  })

  test("passes for iframe with title attribute", () => {
    expectNoOffenses('<iframe src="https://example.com" title="Example content"></iframe>')
  })

  test("passes for link with title attribute", () => {
    expectNoOffenses('<link rel="stylesheet" href="styles.css" title="Main styles">')
  })

  test("fails for button with title attribute", () => {
    expectError("The `title` attribute should never be used as it is inaccessible for several groups of users. Use `aria-label` or `aria-describedby` instead. Exceptions are provided for `<iframe>` and `<link>` elements.")

    assertOffenses('<button title="Click to submit">Submit</button>')
  })

  test("fails for div with title attribute", () => {
    expectError("The `title` attribute should never be used as it is inaccessible for several groups of users. Use `aria-label` or `aria-describedby` instead. Exceptions are provided for `<iframe>` and `<link>` elements.")

    assertOffenses('<div title="Additional information">Content</div>')
  })

  test("fails for span with title attribute", () => {
    expectError("The `title` attribute should never be used as it is inaccessible for several groups of users. Use `aria-label` or `aria-describedby` instead. Exceptions are provided for `<iframe>` and `<link>` elements.")

    assertOffenses('<span title="Tooltip text">Hover me</span>')
  })

  test("fails for input with title attribute", () => {
    expectError("The `title` attribute should never be used as it is inaccessible for several groups of users. Use `aria-label` or `aria-describedby` instead. Exceptions are provided for `<iframe>` and `<link>` elements.")

    assertOffenses('<input type="text" title="Enter your name" placeholder="Name">')
  })

  test("fails for img with title attribute", () => {
    expectError("The `title` attribute should never be used as it is inaccessible for several groups of users. Use `aria-label` or `aria-describedby` instead. Exceptions are provided for `<iframe>` and `<link>` elements.")

    assertOffenses('<img src="image.jpg" alt="Description" title="Additional info">')
  })

  test("fails for anchor with title attribute", () => {
    expectError("The `title` attribute should never be used as it is inaccessible for several groups of users. Use `aria-label` or `aria-describedby` instead. Exceptions are provided for `<iframe>` and `<link>` elements.")

    assertOffenses('<a href="/" title="Go to homepage">Home</a>')
  })

  test("fails for abbr with title attribute", () => {
    expectError("The `title` attribute should never be used as it is inaccessible for several groups of users. Use `aria-label` or `aria-describedby` instead. Exceptions are provided for `<iframe>` and `<link>` elements.")

    assertOffenses('<abbr title="World Wide Web">WWW</abbr>')
  })

  test("handles mixed case element names", () => {
    expectError("The `title` attribute should never be used as it is inaccessible for several groups of users. Use `aria-label` or `aria-describedby` instead. Exceptions are provided for `<iframe>` and `<link>` elements.")

    assertOffenses('<BUTTON title="Submit form">Submit</BUTTON>')
  })

  test("handles mixed case title attribute", () => {
    expectError("The `title` attribute should never be used as it is inaccessible for several groups of users. Use `aria-label` or `aria-describedby` instead. Exceptions are provided for `<iframe>` and `<link>` elements.")

    assertOffenses('<button TITLE="Submit form">Submit</button>')
  })

  test("passes for mixed case allowed elements", () => {
    expectNoOffenses('<IFRAME src="https://example.com" title="Content"></IFRAME>')
  })

  test("handles multiple elements", () => {
    expectError("The `title` attribute should never be used as it is inaccessible for several groups of users. Use `aria-label` or `aria-describedby` instead. Exceptions are provided for `<iframe>` and `<link>` elements.")
    expectError("The `title` attribute should never be used as it is inaccessible for several groups of users. Use `aria-label` or `aria-describedby` instead. Exceptions are provided for `<iframe>` and `<link>` elements.")

    assertOffenses(`
      <iframe src="https://example.com" title="OK iframe"></iframe>
      <button title="Bad button">Click</button>
      <link rel="stylesheet" href="styles.css" title="OK link">
      <div title="Bad div">Content</div>
      <span>OK span</span>
    `)
  })

  test("passes for empty title attribute", () => {
    expectError("The `title` attribute should never be used as it is inaccessible for several groups of users. Use `aria-label` or `aria-describedby` instead. Exceptions are provided for `<iframe>` and `<link>` elements.")

    assertOffenses('<button title="">Empty title</button>')
  })

  test("passes for title attribute with ERB content", () => {
    expectError("The `title` attribute should never be used as it is inaccessible for several groups of users. Use `aria-label` or `aria-describedby` instead. Exceptions are provided for `<iframe>` and `<link>` elements.")

    assertOffenses('<button title="<%= tooltip_text %>">Dynamic tooltip</button>')
  })

  test("ignores elements with proper accessible alternatives", () => {
    expectNoOffenses('<button aria-label="Submit form">Submit</button>')
  })

  test("fails for self-closing elements with title", () => {
    expectError("The `title` attribute should never be used as it is inaccessible for several groups of users. Use `aria-label` or `aria-describedby` instead. Exceptions are provided for `<iframe>` and `<link>` elements.")

    assertOffenses('<input type="text" title="Enter name" />')
  })
})
