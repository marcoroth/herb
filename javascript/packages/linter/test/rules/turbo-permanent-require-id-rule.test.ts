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

  describe("ActionView tag helpers", () => {
    test("passes for tag.div with data-turbo-permanent and an id", () => {
      expectNoOffenses('<%= tag.div id: "cart", data: { turbo_permanent: true } %>')
    })

    test("passes when no `turbo_permanent` key is given", () => {
      expectNoOffenses('<%= tag.div class: "counter" %>')
    })

    test("fails for tag.div with data-turbo-permanent and no id", () => {
      expectError(MESSAGE)

      assertOffenses('<%= tag.div data: { turbo_permanent: true } %>')
    })

    test("fails for content_tag with data-turbo-permanent and no id", () => {
      expectError(MESSAGE)

      assertOffenses('<%= content_tag :div, "1 item", data: { turbo_permanent: true } %>')
    })

    test("fails for the block form with data-turbo-permanent and no id", () => {
      expectError(MESSAGE)

      assertOffenses('<%= tag.div(data: { turbo_permanent: true }) do %>1 item<% end %>')
    })

    test("passes for a dynamic id, which can't be resolved statically", () => {
      expectNoOffenses('<%= tag.div id: dom_id(cart), data: { turbo_permanent: true } %>')
    })

    test("passes for an interpolated id", () => {
      expectNoOffenses('<%= tag.div id: "cart-#{cart.id}", data: { turbo_permanent: true } %>')
    })

    // ActionView drops `id` entirely when the value is nil, so this renders a permanent
    // element with no id at all. The parser still emits the attribute node, so the rule
    // sees an id and stays quiet.
    test.fails("fails for a nil id, which ActionView omits entirely", () => {
      expectError(MESSAGE)

      assertOffenses('<%= tag.div id: nil, data: { turbo_permanent: true } %>')
    })
  })
})
