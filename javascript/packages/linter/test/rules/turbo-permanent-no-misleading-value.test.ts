import { describe, test } from "vitest"
import { TurboPermanentNoMisleadingValueRule } from "../../src/rules/turbo-permanent-no-misleading-value.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(TurboPermanentNoMisleadingValueRule)

describe("turbo-permanent-no-misleading-value", () => {
  test("passes when no explicit value is given", () => {
    expectNoOffenses('<div id="cart-counter" data-turbo-permanent>1 item</div>')
  })

  test("passes when attribute is absent", () => {
    expectNoOffenses('<div id="cart-counter">1 item</div>')
  })

  test("fails with value `true`", () => {
    expectError('Attribute `data-turbo-permanent` should not have a value. `data-turbo-permanent="true"` is redundant, because Turbo only checks whether the attribute is present. Use `data-turbo-permanent` instead.')

    assertOffenses('<div id="cart-counter" data-turbo-permanent="true">1 item</div>')
  })

  test("fails with value `TRUE`", () => {
    expectError('Attribute `data-turbo-permanent` should not have a value. `data-turbo-permanent="TRUE"` is redundant, because Turbo only checks whether the attribute is present. Use `data-turbo-permanent` instead.')

    assertOffenses('<div id="cart-counter" data-turbo-permanent="TRUE">1 item</div>')
  })

  test("fails with value `false`", () => {
    expectError('Attribute `data-turbo-permanent` should not have a value. `data-turbo-permanent="false"` still makes the element permanent, because Turbo only checks whether the attribute is present. Use `data-turbo-permanent` instead.')

    assertOffenses('<div id="cart-counter" data-turbo-permanent="false">1 item</div>')
  })

  test("fails with arbitrary value", () => {
    expectError('Attribute `data-turbo-permanent` should not have a value. `data-turbo-permanent="foo"` still makes the element permanent, because Turbo only checks whether the attribute is present. Use `data-turbo-permanent` instead.')

    assertOffenses('<div id="cart-counter" data-turbo-permanent="foo">1 item</div>')
  })

  test("fails with empty string value", () => {
    expectError('Attribute `data-turbo-permanent` should not have a value. `data-turbo-permanent=""` still makes the element permanent, because Turbo only checks whether the attribute is present. Use `data-turbo-permanent` instead.')

    assertOffenses('<div id="cart-counter" data-turbo-permanent="">1 item</div>')
  })

  describe("ActionView tag helpers", () => {
    test("passes when no `turbo_permanent` key is given", () => {
      expectNoOffenses('<%= tag.div id: "cart", class: "counter" %>')
    })

    test("fails with `turbo_permanent: false`", () => {
      expectError('Attribute `data-turbo-permanent` should not have a value. `data-turbo-permanent: "false"` still makes the element permanent, because Turbo only checks whether the attribute is present. Use `data-turbo-permanent` instead.')

      assertOffenses('<%= tag.div id: "cart", data: { turbo_permanent: false } %>')
    })

    test("fails with `turbo_permanent: true`", () => {
      expectError('Attribute `data-turbo-permanent` should not have a value. `data-turbo-permanent: "true"` is redundant, because Turbo only checks whether the attribute is present. Use `data-turbo-permanent` instead.')

      assertOffenses('<%= tag.div id: "cart", data: { turbo_permanent: true } %>')
    })

    test("fails with `turbo_permanent: \"false\"`", () => {
      expectError('Attribute `data-turbo-permanent` should not have a value. `data-turbo-permanent: "false"` still makes the element permanent, because Turbo only checks whether the attribute is present. Use `data-turbo-permanent` instead.')

      assertOffenses('<%= tag.div id: "cart", data: { turbo_permanent: "false" } %>')
    })

    test("fails with empty string value", () => {
      expectError('Attribute `data-turbo-permanent` should not have a value. `data-turbo-permanent: ""` still makes the element permanent, because Turbo only checks whether the attribute is present. Use `data-turbo-permanent` instead.')

      assertOffenses('<%= tag.div id: "cart", data: { turbo_permanent: "" } %>')
    })

    test("fails for `content_tag`", () => {
      expectError('Attribute `data-turbo-permanent` should not have a value. `data-turbo-permanent: "false"` still makes the element permanent, because Turbo only checks whether the attribute is present. Use `data-turbo-permanent` instead.')

      assertOffenses('<%= content_tag :div, "1 item", data: { turbo_permanent: false } %>')
    })

    test("passes for `turbo_permanent: nil`, which ActionView omits entirely", () => {
      expectNoOffenses('<%= tag.div id: "cart", data: { turbo_permanent: nil } %>')
    })

    test("passes for a dynamic value, which can't be resolved statically", () => {
      expectNoOffenses('<%= tag.div id: "cart", data: { turbo_permanent: permanent? } %>')
    })
  })
})
