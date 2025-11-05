import { describe, test } from "vitest"
import { HTMLTurboPermanentRule } from "../../src/rules/html-turbo-permanent.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(HTMLTurboPermanentRule)

describe("html-tubro-permanent", () => {
  test("passes when no explicit value is given", () => {
    expectNoOffenses('<div id="cart-counter" data-turbo-permanent>1 item</div>')
  })

  test("passes when empty explicit value is given", () => {
    expectError('')
    assertOffenses('<div id="cart-counter" data-turbo-permanent="">1 item</div>')
  })

  test("passes when string true value is given", () => {
    expectNoOffenses('<div id="cart-counter" data-turbo-permanent="true">1 item</div>')
  })

  test("fails when passing permanent=false", () => {
    expectError('Attribute `data-turbo-permanent` should not contain value "false"')
    assertOffenses('<div id="cart-counter" data-turbo-permanent="false">1 item</div>')
  })
})
