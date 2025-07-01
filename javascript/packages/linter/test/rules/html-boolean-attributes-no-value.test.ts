import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../../src/linter.js"
import { HTMLBooleanAttributesNoValueRule } from "../../src/rules/html-boolean-attributes-no-value.js"

describe("html-boolean-attributes-no-value", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("passes for boolean attributes without values", () => {
    const html = '<input type="checkbox" checked disabled>'
    const result = Herb.parse(html)
    const linter = new Linter([HTMLBooleanAttributesNoValueRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.messages).toHaveLength(0)
  })

  test("fails for boolean attributes with explicit values", () => {
    const html = '<input type="checkbox" checked="checked" disabled="disabled">'
    const result = Herb.parse(html)
    const linter = new Linter([HTMLBooleanAttributesNoValueRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(2)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.messages).toHaveLength(2)

    expect(lintResult.messages[0].id).toBe("html-boolean-attributes-no-value")
    expect(lintResult.messages[0].message).toBe('Boolean attribute `checked` should not have a value. Use `checked` instead of `checked="checked"`.')
    expect(lintResult.messages[0].severity).toBe("error")

    expect(lintResult.messages[1].id).toBe("html-boolean-attributes-no-value")
    expect(lintResult.messages[1].message).toBe('Boolean attribute `disabled` should not have a value. Use `disabled` instead of `disabled="disabled"`.')
    expect(lintResult.messages[1].severity).toBe("error")
  })

  test("fails for boolean attributes with true/false values", () => {
    const html = '<button disabled="true">Submit</button>'
    const result = Herb.parse(html)
    const linter = new Linter([HTMLBooleanAttributesNoValueRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.messages[0].message).toBe('Boolean attribute `disabled` should not have a value. Use `disabled` instead of `disabled="disabled"`.')
  })

  test("passes for non-boolean attributes with values", () => {
    const html = '<input type="text" value="Username" name="user">'
    const result = Herb.parse(html)
    const linter = new Linter([HTMLBooleanAttributesNoValueRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
  })

  test("handles multiple boolean attributes", () => {
    const html = '<select multiple="multiple"><option selected="selected">Option 1</option></select>'
    const result = Herb.parse(html)
    const linter = new Linter([HTMLBooleanAttributesNoValueRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(2)
    expect(lintResult.messages[0].message).toBe('Boolean attribute `multiple` should not have a value. Use `multiple` instead of `multiple="multiple"`.')
    expect(lintResult.messages[1].message).toBe('Boolean attribute `selected` should not have a value. Use `selected` instead of `selected="selected"`.')
  })

  test("handles self-closing tags with boolean attributes", () => {
    const html = '<input type="checkbox" checked="checked" required="true" />'
    const result = Herb.parse(html)
    const linter = new Linter([HTMLBooleanAttributesNoValueRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(2)
    expect(lintResult.messages[0].message).toBe('Boolean attribute `checked` should not have a value. Use `checked` instead of `checked="checked"`.')
    expect(lintResult.messages[1].message).toBe('Boolean attribute `required` should not have a value. Use `required` instead of `required="required"`.')
  })

  test("handles case insensitive boolean attributes", () => {
    const html = '<input CHECKED="CHECKED" DISABLED="disabled">'
    const result = Herb.parse(html)
    const linter = new Linter([HTMLBooleanAttributesNoValueRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(2)
    expect(lintResult.messages[0].message).toBe('Boolean attribute `checked` should not have a value. Use `checked` instead of `checked="checked"`.')
    expect(lintResult.messages[1].message).toBe('Boolean attribute `disabled` should not have a value. Use `disabled` instead of `disabled="disabled"`.')
  })

  test("passes for video controls", () => {
    const html = '<video controls>'
    const result = Herb.parse(html)
    const linter = new Linter([HTMLBooleanAttributesNoValueRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
  })

  test("fails for video controls with value", () => {
    const html = '<video controls="controls" autoplay="autoplay">'
    const result = Herb.parse(html)
    const linter = new Linter([HTMLBooleanAttributesNoValueRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(2)
    expect(lintResult.messages[0].message).toBe('Boolean attribute `controls` should not have a value. Use `controls` instead of `controls="controls"`.')
    expect(lintResult.messages[1].message).toBe('Boolean attribute `autoplay` should not have a value. Use `autoplay` instead of `autoplay="autoplay"`.')
  })

  test("fails for boolean attribute with different value", () => {
    const html = '<video controls="something-else">'
    const result = Herb.parse(html)
    const linter = new Linter([HTMLBooleanAttributesNoValueRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.messages[0].message).toBe('Boolean attribute `controls` should not have a value. Use `controls` instead of `controls="controls"`.')
  })

  test("handles mixed boolean and regular attributes", () => {
    const html = '<form novalidate="novalidate" action="/submit" method="post">'
    const result = Herb.parse(html)
    const linter = new Linter([HTMLBooleanAttributesNoValueRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.messages[0].message).toBe('Boolean attribute `novalidate` should not have a value. Use `novalidate` instead of `novalidate="novalidate"`.')
  })
})
