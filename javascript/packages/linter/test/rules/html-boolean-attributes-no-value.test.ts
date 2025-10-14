import { describe, test } from "vitest"
import { HTMLBooleanAttributesNoValueRule } from "../../src/rules/html-boolean-attributes-no-value.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(HTMLBooleanAttributesNoValueRule)

describe("html-boolean-attributes-no-value", () => {
  test("passes for boolean attributes without values", () => {
    expectNoOffenses('<input type="checkbox" checked disabled>')
  })

  test("fails for boolean attributes with explicit values", () => {
    expectError('Boolean attribute `checked` should not have a value. Use `checked` instead of `checked="checked"`.')
    expectError('Boolean attribute `disabled` should not have a value. Use `disabled` instead of `disabled="disabled"`.')

    assertOffenses('<input type="checkbox" checked="checked" disabled="disabled">')
  })

  test("fails for boolean attributes with true/false values", () => {
    expectError('Boolean attribute `disabled` should not have a value. Use `disabled` instead of `disabled="true"`.')

    assertOffenses('<button disabled="true">Submit</button>')
  })

  test("passes for non-boolean attributes with values", () => {
    expectNoOffenses('<input type="text" value="Username" name="user">')
  })

  test("handles multiple boolean attributes", () => {
    expectError('Boolean attribute `multiple` should not have a value. Use `multiple` instead of `multiple="multiple"`.')
    expectError('Boolean attribute `selected` should not have a value. Use `selected` instead of `selected="selected"`.')

    assertOffenses('<select multiple="multiple"><option selected="selected">Option 1</option></select>')
  })

  test("handles self-closing tags with boolean attributes", () => {
    expectError('Boolean attribute `checked` should not have a value. Use `checked` instead of `checked="checked"`.')
    expectError('Boolean attribute `required` should not have a value. Use `required` instead of `required="true"`.')

    assertOffenses('<input type="checkbox" checked="checked" required="true" />')
  })

  test("handles case insensitive boolean attributes", () => {
    expectError('Boolean attribute `CHECKED` should not have a value. Use `checked` instead of `CHECKED="CHECKED"`.')
    expectError('Boolean attribute `DISABLED` should not have a value. Use `disabled` instead of `DISABLED="disabled"`.')

    assertOffenses('<input CHECKED="CHECKED" DISABLED="disabled">')
  })

  test("passes for video controls", () => {
    expectNoOffenses('<video controls></video>')
  })

  test("fails for video controls with value", () => {
    expectError('Boolean attribute `controls` should not have a value. Use `controls` instead of `controls="controls"`.')
    expectError('Boolean attribute `autoplay` should not have a value. Use `autoplay` instead of `autoplay="autoplay"`.')

    assertOffenses('<video controls="controls" autoplay="autoplay"></video>')
  })

  test("fails for boolean attribute with different value", () => {
    expectError('Boolean attribute `controls` should not have a value. Use `controls` instead of `controls="something-else"`.')

    assertOffenses('<video controls="something-else"></video>')
  })

  test("handles mixed boolean and regular attributes", () => {
    expectError('Boolean attribute `novalidate` should not have a value. Use `novalidate` instead of `novalidate="novalidate"`.')

    assertOffenses('<form novalidate="novalidate" action="/submit" method="post"></form>')
  })

  test("fails for boolean attributes with ERB output value", () => {
    expectError('Boolean attribute `disabled` should not have a value. Use `disabled` instead of `disabled="<%= disabled? %>"`.')

    assertOffenses('<button disabled="<%= disabled? %>">Submit</button>')
  })
})
