import { describe, test } from "vitest"
import { A11yNestedInteractiveElementsRule } from "../../src/rules/a11y-nested-interactive-elements.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(A11yNestedInteractiveElementsRule)

describe("a11y-nested-interactive-elements", () => {
  test("passes for button without nested interactive elements", () => {
    expectNoOffenses('<button>Confirm</button>')
  })

  test("passes for anchor without nested interactive elements", () => {
    expectNoOffenses('<a href="/about">About</a>')
  })

  test("passes for non-interactive parent with interactive child", () => {
    expectNoOffenses('<div><a href="/about">About</a></div>')
  })

  test("passes for summary with nested anchor (allowed exception)", () => {
    expectNoOffenses('<summary><a href="/about">About</a></summary>')
  })

  test("passes for hidden input inside button", () => {
    expectNoOffenses('<button><input type="hidden" name="token" /></button>')
  })

  test("fails for anchor nested inside button", () => {
    expectError('Found `<a>` nested inside of `<button>`. Nesting interactive elements produces invalid HTML, and assistive technologies, such as screen readers, might ignore or respond unexpectedly to such nested controls.')

    assertOffenses('<button><a href="https://github.com/">Go to GitHub</a></button>')
  })

  test("fails for button nested inside anchor", () => {
    expectError('Found `<button>` nested inside of `<a>`. Nesting interactive elements produces invalid HTML, and assistive technologies, such as screen readers, might ignore or respond unexpectedly to such nested controls.')

    assertOffenses('<a href="/about"><button>Click</button></a>')
  })

  test("fails for select nested inside button", () => {
    expectError('Found `<select>` nested inside of `<button>`. Nesting interactive elements produces invalid HTML, and assistive technologies, such as screen readers, might ignore or respond unexpectedly to such nested controls.')

    assertOffenses('<button><select><option>A</option></select></button>')
  })

  test("fails for textarea nested inside anchor", () => {
    expectError('Found `<textarea>` nested inside of `<a>`. Nesting interactive elements produces invalid HTML, and assistive technologies, such as screen readers, might ignore or respond unexpectedly to such nested controls.')

    assertOffenses('<a href="/edit"><textarea></textarea></a>')
  })

  test("fails for input nested inside button", () => {
    expectError('Found `<input>` nested inside of `<button>`. Nesting interactive elements produces invalid HTML, and assistive technologies, such as screen readers, might ignore or respond unexpectedly to such nested controls.')

    assertOffenses('<button><input type="text" /></button>')
  })
})
