import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../../src/linter.js"
import { HTMLAttributeValuesRequireQuotesRule } from "../../src/rules/html-attribute-values-require-quotes.js"

describe("html-attribute-values-require-quotes", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("passes for quoted attribute values", () => {
    const html = '<div id="hello" class="container">'
    const result = Herb.parse(html)
    const linter = new Linter([HTMLAttributeValuesRequireQuotesRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(0)
  })

  test("fails for unquoted attribute values", () => {
    const html = '<div id=hello class=container>'
    const result = Herb.parse(html)
    const linter = new Linter([HTMLAttributeValuesRequireQuotesRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(2) // Both id and class are unquoted
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(2)

    expect(lintResult.offenses[0].rule).toBe("html-attribute-values-require-quotes")
    expect(lintResult.offenses[0].message).toBe('Attribute value should be quoted: `id="value"`. Always wrap attribute values in quotes.')
    expect(lintResult.offenses[0].severity).toBe("error")
  })

  test("passes for single-quoted values", () => {
    const html = "<div id='hello' class='container'>"
    const result = Herb.parse(html)
    const linter = new Linter([HTMLAttributeValuesRequireQuotesRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
  })

  test("passes for boolean attributes without values", () => {
    const html = '<input type="text" disabled>'
    const result = Herb.parse(html)
    const linter = new Linter([HTMLAttributeValuesRequireQuotesRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
  })

  test("handles mixed quoted and unquoted", () => {
    const html = '<input type="text" name=username value="test">'
    const result = Herb.parse(html)
    const linter = new Linter([HTMLAttributeValuesRequireQuotesRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(1) // Only name is unquoted
    expect(lintResult.offenses[0].message).toBe('Attribute value should be quoted: `name="value"`. Always wrap attribute values in quotes.')
  })

  test("handles ERB in quoted attributes", () => {
    const html = '<div class="<%= classes %>" data-id="<%= item.id %>">'
    const result = Herb.parse(html)
    const linter = new Linter([HTMLAttributeValuesRequireQuotesRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
  })

  test("handles self-closing tags", () => {
    const html = '<img src=photo.jpg alt="Photo">'
    const result = Herb.parse(html)
    const linter = new Linter([HTMLAttributeValuesRequireQuotesRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.offenses[0].message).toBe('Attribute value should be quoted: `src="value"`. Always wrap attribute values in quotes.')
  })

  test("handles complex attribute values", () => {
    const html = '<a href="/profile" title=User\\ Profile>'
    const result = Herb.parse(html)
    const linter = new Linter([HTMLAttributeValuesRequireQuotesRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.offenses[0].message).toBe('Attribute value should be quoted: `title="value"`. Always wrap attribute values in quotes.')
  })

  test("ignores closing tags", () => {
    const html = '<div class="test"></div>'
    const result = Herb.parse(html)
    const linter = new Linter([HTMLAttributeValuesRequireQuotesRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
  })
})
