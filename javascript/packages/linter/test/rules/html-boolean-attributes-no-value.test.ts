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

    const linter = new Linter(Herb, [HTMLBooleanAttributesNoValueRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(0)
  })

  test("fails for boolean attributes with explicit values", () => {
    const html = '<input type="checkbox" checked="checked" disabled="disabled">'

    const linter = new Linter(Herb, [HTMLBooleanAttributesNoValueRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(2)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(2)

    expect(lintResult.offenses[0].rule).toBe("html-boolean-attributes-no-value")
    expect(lintResult.offenses[0].message).toBe('Boolean attribute `checked` should not have a value. Use `checked` instead of `checked="checked"`.')
    expect(lintResult.offenses[0].severity).toBe("error")

    expect(lintResult.offenses[1].rule).toBe("html-boolean-attributes-no-value")
    expect(lintResult.offenses[1].message).toBe('Boolean attribute `disabled` should not have a value. Use `disabled` instead of `disabled="disabled"`.')
    expect(lintResult.offenses[1].severity).toBe("error")
  })

  test("fails for boolean attributes with true/false values", () => {
    const html = '<button disabled="true">Submit</button>'

    const linter = new Linter(Herb, [HTMLBooleanAttributesNoValueRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.offenses[0].message).toBe('Boolean attribute `disabled` should not have a value. Use `disabled` instead of `disabled="true"`.')
  })

  test("passes for non-boolean attributes with values", () => {
    const html = '<input type="text" value="Username" name="user">'

    const linter = new Linter(Herb, [HTMLBooleanAttributesNoValueRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
  })

  test("handles multiple boolean attributes", () => {
    const html = '<select multiple="multiple"><option selected="selected">Option 1</option></select>'

    const linter = new Linter(Herb, [HTMLBooleanAttributesNoValueRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(2)
    expect(lintResult.offenses[0].message).toBe('Boolean attribute `multiple` should not have a value. Use `multiple` instead of `multiple="multiple"`.')
    expect(lintResult.offenses[1].message).toBe('Boolean attribute `selected` should not have a value. Use `selected` instead of `selected="selected"`.')
  })

  test("handles self-closing tags with boolean attributes", () => {
    const html = '<input type="checkbox" checked="checked" required="true" />'

    const linter = new Linter(Herb, [HTMLBooleanAttributesNoValueRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(2)
    expect(lintResult.offenses[0].message).toBe('Boolean attribute `checked` should not have a value. Use `checked` instead of `checked="checked"`.')
    expect(lintResult.offenses[1].message).toBe('Boolean attribute `required` should not have a value. Use `required` instead of `required="true"`.')
  })

  test("handles case insensitive boolean attributes", () => {
    const html = '<input CHECKED="CHECKED" DISABLED="disabled">'

    const linter = new Linter(Herb, [HTMLBooleanAttributesNoValueRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(2)
    expect(lintResult.offenses[0].message).toBe('Boolean attribute `CHECKED` should not have a value. Use `checked` instead of `CHECKED="CHECKED"`.')
    expect(lintResult.offenses[1].message).toBe('Boolean attribute `DISABLED` should not have a value. Use `disabled` instead of `DISABLED="disabled"`.')
  })

  test("passes for video controls", () => {
    const html = '<video controls>'

    const linter = new Linter(Herb, [HTMLBooleanAttributesNoValueRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
  })

  test("fails for video controls with value", () => {
    const html = '<video controls="controls" autoplay="autoplay">'

    const linter = new Linter(Herb, [HTMLBooleanAttributesNoValueRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(2)
    expect(lintResult.offenses[0].message).toBe('Boolean attribute `controls` should not have a value. Use `controls` instead of `controls="controls"`.')
    expect(lintResult.offenses[1].message).toBe('Boolean attribute `autoplay` should not have a value. Use `autoplay` instead of `autoplay="autoplay"`.')
  })

  test("fails for boolean attribute with different value", () => {
    const html = '<video controls="something-else">'

    const linter = new Linter(Herb, [HTMLBooleanAttributesNoValueRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.offenses[0].message).toBe('Boolean attribute `controls` should not have a value. Use `controls` instead of `controls="something-else"`.')
  })

  test("handles mixed boolean and regular attributes", () => {
    const html = '<form novalidate="novalidate" action="/submit" method="post">'

    const linter = new Linter(Herb, [HTMLBooleanAttributesNoValueRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.offenses[0].message).toBe('Boolean attribute `novalidate` should not have a value. Use `novalidate` instead of `novalidate="novalidate"`.')
  })

  test("fails for boolean attributes with ERB output value", () => {
    const html = '<button disabled="<%= disabled? %>">Submit</button>'

    const linter = new Linter(Herb, [HTMLBooleanAttributesNoValueRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.offenses[0].message).toBe('Boolean attribute `disabled` should not have a value. Use `disabled` instead of `disabled="<%= disabled? %>"`.')
  })
})
