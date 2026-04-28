import { describe, test } from "vitest"
import { TurboPermanentRequireIdRule } from "../../src/rules/turbo-permanent-require-id.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(TurboPermanentRequireIdRule)

const MESSAGE = "Elements with `data-turbo-permanent` must have an `id` attribute. Without an `id`, Turbo can't track the element across page changes and the permanent behavior won't work as expected."

describe("turbo-permanent-require-id", () => {
  test("passes for element with data-turbo-permanent and id", () => {
    expectNoOffenses('<div id="flash-messages" data-turbo-permanent>Flash</div>')
  })

  test("fails for element with data-turbo-permanent but no id", () => {
    expectError(MESSAGE)

    assertOffenses('<div data-turbo-permanent>Flash</div>')
  })

  test("passes for element without data-turbo-permanent", () => {
    expectNoOffenses('<div class="container">Content</div>')
  })

  test("passes for element with only id", () => {
    expectNoOffenses('<div id="my-element">Content</div>')
  })

  test("fails for self-closing element with data-turbo-permanent but no id", () => {
    expectError(MESSAGE)

    assertOffenses('<input data-turbo-permanent>')
  })

  test("passes for self-closing element with data-turbo-permanent and id", () => {
    expectNoOffenses('<input id="my-input" data-turbo-permanent>')
  })

  test("fails for multiple elements with data-turbo-permanent but no id", () => {
    expectError(MESSAGE)
    expectError(MESSAGE)

    assertOffenses('<div data-turbo-permanent>Flash</div>\n<span data-turbo-permanent>Notice</span>')
  })

  test("passes for element with data-turbo-permanent and ERB id", () => {
    expectNoOffenses('<div id="<%= dom_id(record) %>" data-turbo-permanent>Content</div>')
  })

  test("passes for element with data-turbo-permanent value and id", () => {
    expectNoOffenses('<div id="cart" data-turbo-permanent="">Cart</div>')
  })

  test("fails for element with other data attributes but no id", () => {
    expectError(MESSAGE)

    assertOffenses('<div class="flash" data-turbo-permanent data-controller="flash">Flash</div>')
  })
})
