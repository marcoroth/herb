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

  test("fails for anchor deeply nested inside button", () => {
    expectError('Found `<a>` nested inside of `<button>`. Nesting interactive elements produces invalid HTML, and assistive technologies, such as screen readers, might ignore or respond unexpectedly to such nested controls.')

    assertOffenses('<button><span><a href="#">Link</a></span></button>')
  })

  test("fails for input deeply nested inside anchor", () => {
    expectError('Found `<input>` nested inside of `<a>`. Nesting interactive elements produces invalid HTML, and assistive technologies, such as screen readers, might ignore or respond unexpectedly to such nested controls.')

    assertOffenses('<a href="#"><div><input type="text" /></div></a>')
  })

  test("fails for input with dynamic type inside button", () => {
    expectError('Found `<input>` nested inside of `<button>`. Nesting interactive elements produces invalid HTML, and assistive technologies, such as screen readers, might ignore or respond unexpectedly to such nested controls.')

    assertOffenses('<button><input type="<%= type %>" /></button>')
  })

  test("passes for div with role=button containing anchor", () => {
    expectNoOffenses('<div role="button"><a href="#">Link</a></div>')
  })

  test("fails for tag.a nested inside tag.button", () => {
    expectError('Found `<a>` nested inside of `<button>`. Nesting interactive elements produces invalid HTML, and assistive technologies, such as screen readers, might ignore or respond unexpectedly to such nested controls.')

    assertOffenses('<%= tag.button do %><%= link_to "Click", "#" %><% end %>')
  })

  test("passes for tag.button without nested interactive elements", () => {
    expectNoOffenses('<%= tag.button "Confirm" %>')
  })

  test("fails for button with nested link_to", () => {
    expectError('Found `<a>` nested inside of `<button>`. Nesting interactive elements produces invalid HTML, and assistive technologies, such as screen readers, might ignore or respond unexpectedly to such nested controls.')

    assertOffenses('<button><%= link_to "Click", "#" %></button>')
  })

  test("fails for link_to block with nested button", () => {
    expectError('Found `<button>` nested inside of `<a>`. Nesting interactive elements produces invalid HTML, and assistive technologies, such as screen readers, might ignore or respond unexpectedly to such nested controls.')

    assertOffenses('<%= link_to "#" do %><button>Click</button><% end %>')
  })

  test("fails for link_to block with nested tag.button", () => {
    expectError('Found `<button>` nested inside of `<a>`. Nesting interactive elements produces invalid HTML, and assistive technologies, such as screen readers, might ignore or respond unexpectedly to such nested controls.')

    assertOffenses('<%= link_to "#" do %><%= tag.button "Click" %><% end %>')
  })

  test("passes for link_to block with non-interactive content", () => {
    expectNoOffenses('<%= link_to "#" do %><%= tag.span "Click" %><% end %>')
  })

  test("passes for tag.summary with nested link_to", () => {
    expectNoOffenses('<%= tag.summary do %><%= link_to "Details", "#" %><% end %>')
  })

  test("fails for tag.button with nested tag.select", () => {
    expectError('Found `<select>` nested inside of `<button>`. Nesting interactive elements produces invalid HTML, and assistive technologies, such as screen readers, might ignore or respond unexpectedly to such nested controls.')

    assertOffenses('<%= tag.button do %><%= tag.select do %><option>A</option><% end %><% end %>')
  })

  test("passes for tag.button with nested hidden input", () => {
    expectNoOffenses('<%= tag.button do %><%= tag.input type: "hidden", name: "token" %><% end %>')
  })

  test("reports multiple offenses for multiple nested interactive elements", () => {
    expectError('Found `<a>` nested inside of `<button>`. Nesting interactive elements produces invalid HTML, and assistive technologies, such as screen readers, might ignore or respond unexpectedly to such nested controls.')
    expectError('Found `<input>` nested inside of `<button>`. Nesting interactive elements produces invalid HTML, and assistive technologies, such as screen readers, might ignore or respond unexpectedly to such nested controls.')

    assertOffenses('<button><a href="#">Link</a><input type="text" /></button>')
  })
})
