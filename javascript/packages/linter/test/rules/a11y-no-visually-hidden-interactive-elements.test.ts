import { describe, test } from "vitest"
import { A11yNoVisuallyHiddenInteractiveElementsRule } from "../../src/rules/a11y-no-visually-hidden-interactive-elements.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectWarning, assertOffenses } = createLinterTest(A11yNoVisuallyHiddenInteractiveElementsRule)

const MESSAGE = "Avoid visually hiding interactive elements. Visually hiding interactive elements can be confusing to sighted keyboard users as it appears their focus has been lost when they navigate to the hidden element."

describe("a11y-no-visually-hidden-interactive-elements", () => {
  test("passes for non-interactive element with sr-only", () => {
    expectNoOffenses('<h2 class="sr-only">Welcome to GitHub</h2>')
  })

  test("passes for non-interactive element with sr-only class among others", () => {
    expectNoOffenses('<span class="sr-only text-bold">Visually hidden text</span>')
  })

  test("passes for interactive element without sr-only", () => {
    expectNoOffenses('<button class="btn">Submit</button>')
  })

  test("passes for interactive element without class attribute", () => {
    expectNoOffenses('<button>Submit</button>')
  })

  test("passes for div with sr-only", () => {
    expectNoOffenses('<div class="sr-only">Hidden content</div>')
  })

  test("passes for p with sr-only", () => {
    expectNoOffenses('<p class="sr-only">Hidden text</p>')
  })

  test("fails for button with sr-only", () => {
    expectWarning(MESSAGE)
    assertOffenses('<button class="sr-only">Submit</button>')
  })

  test("fails for a with sr-only", () => {
    expectWarning(MESSAGE)
    assertOffenses('<a class="sr-only" href="/about">About</a>')
  })

  test("fails for summary with sr-only", () => {
    expectWarning(MESSAGE)
    assertOffenses('<summary class="sr-only">Details</summary>')
  })

  test("fails for select with sr-only", () => {
    expectWarning(MESSAGE)
    assertOffenses('<select class="sr-only"><option>A</option></select>')
  })

  test("fails for option with sr-only", () => {
    expectWarning(MESSAGE)
    assertOffenses('<option class="sr-only">A</option>')
  })

  test("fails for textarea with sr-only", () => {
    expectWarning(MESSAGE)
    assertOffenses('<textarea class="sr-only"></textarea>')
  })

  test("fails for button with sr-only among other classes", () => {
    expectWarning(MESSAGE)
    assertOffenses('<button class="btn sr-only primary">Submit</button>')
  })

  test("passes for button with sr-only and focus:not-sr-only", () => {
    expectNoOffenses('<button class="sr-only focus:not-sr-only">Skip to content</button>')
  })

  test("passes for a with sr-only and focus-within:not-sr-only", () => {
    expectNoOffenses('<a class="sr-only focus-within:not-sr-only" href="#main">Skip to content</a>')
  })

  test("does not flag input elements", () => {
    expectNoOffenses('<input class="sr-only" type="file" />')
  })
})
