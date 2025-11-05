import { describe, test } from "vitest"
import { HtmlTurboPermanentRule } from "../../src/rules/html-turbo-permanent.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(HtmlTurboPermanentRule)

describe("html-turbo-permanent", () => {
  test("passes when no explicit value is given", () => {
    expectNoOffenses('<div id="cart-counter" data-turbo-permanent>1 item</div>')
  })

  test("fails when string true value is given", () => {
    expectError('Attribute `data-turbo-permanent` should not contain any value')
    assertOffenses('<div id="cart-counter" data-turbo-permanent="true">1 item</div>')
  })

  test("fails when passing permanent=false", () => {
    expectError('Attribute `data-turbo-permanent` should not contain any value')
    assertOffenses('<div id="cart-counter" data-turbo-permanent="false">1 item</div>')
  })

  test("fails when other value is passed", () => {
    expectError('Attribute `data-turbo-permanent` should not contain any value')
    assertOffenses('<div id="cart-counter" data-turbo-permanent="foo">1 item</div>')
  })
})
