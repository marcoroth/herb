import { describe, test } from "vitest"
import { TurboPermanentNoMisleadingValueRule } from "../../src/rules/turbo-permanent-no-misleading-value.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(TurboPermanentNoMisleadingValueRule)

const message = (attribute: string) => `Attribute \`data-turbo-permanent\` should not have a value. \`${attribute}\` still makes the element permanent, because Turbo only checks whether the attribute is present. Use \`data-turbo-permanent\` instead.`

describe("turbo-permanent-no-misleading-value", () => {
  test("passes when no explicit value is given", () => {
    expectNoOffenses('<div id="cart-counter" data-turbo-permanent>1 item</div>')
  })

  test("passes when attribute is absent", () => {
    expectNoOffenses('<div id="cart-counter">1 item</div>')
  })

  test("fails with value `true`", () => {
    expectError(message('data-turbo-permanent="true"'))
    assertOffenses('<div id="cart-counter" data-turbo-permanent="true">1 item</div>')
  })

  test("fails with value `false`", () => {
    expectError(message('data-turbo-permanent="false"'))
    assertOffenses('<div id="cart-counter" data-turbo-permanent="false">1 item</div>')
  })

  test("fails with arbitrary value", () => {
    expectError(message('data-turbo-permanent="foo"'))
    assertOffenses('<div id="cart-counter" data-turbo-permanent="foo">1 item</div>')
  })

  test("fails with empty string value", () => {
    expectError(message('data-turbo-permanent=""'))
    assertOffenses('<div id="cart-counter" data-turbo-permanent="">1 item</div>')
  })

  describe("ActionView tag helpers", () => {
    test("passes when no `turbo_permanent` key is given", () => {
      expectNoOffenses('<%= tag.div id: "cart", class: "counter" %>')
    })

    test("fails with `turbo_permanent: false`", () => {
      expectError(message('data-turbo-permanent: "false"'))

      assertOffenses('<%= tag.div id: "cart", data: { turbo_permanent: false } %>')
    })

    test("fails with `turbo_permanent: true`", () => {
      expectError(message('data-turbo-permanent: "true"'))

      assertOffenses('<%= tag.div id: "cart", data: { turbo_permanent: true } %>')
    })

    test("fails with `turbo_permanent: \"false\"`", () => {
      expectError(message('data-turbo-permanent: "false"'))

      assertOffenses('<%= tag.div id: "cart", data: { turbo_permanent: "false" } %>')
    })

    test("fails with empty string value", () => {
      expectError(message('data-turbo-permanent: ""'))

      assertOffenses('<%= tag.div id: "cart", data: { turbo_permanent: "" } %>')
    })

    test("fails for `content_tag`", () => {
      expectError(message('data-turbo-permanent: "false"'))

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
