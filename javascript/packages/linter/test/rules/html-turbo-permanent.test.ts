import { describe, test } from "vitest"
import { HTMLTurboPermanentRule } from "../../src/rules/html-turbo-permanent.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(HTMLTurboPermanentRule)

const MESSAGE = "Attribute `data-turbo-permanent` should not contain any value. Its presence alone enables the behavior, so values like `\"true\"` or `\"false\"` are misleading."

describe("html-turbo-permanent", () => {
  test("passes when no explicit value is given", () => {
    expectNoOffenses('<div id="cart-counter" data-turbo-permanent>1 item</div>')
  })

  test("passes when attribute is absent", () => {
    expectNoOffenses('<div id="cart-counter">1 item</div>')
  })

  test("fails with value `true`", () => {
    expectError(MESSAGE)
    assertOffenses('<div id="cart-counter" data-turbo-permanent="true">1 item</div>')
  })

  test("fails with value `false`", () => {
    expectError(MESSAGE)
    assertOffenses('<div id="cart-counter" data-turbo-permanent="false">1 item</div>')
  })

  test("fails with arbitrary value", () => {
    expectError(MESSAGE)
    assertOffenses('<div id="cart-counter" data-turbo-permanent="foo">1 item</div>')
  })

  test("fails with empty string value", () => {
    expectError(MESSAGE)
    assertOffenses('<div id="cart-counter" data-turbo-permanent="">1 item</div>')
  })
})
