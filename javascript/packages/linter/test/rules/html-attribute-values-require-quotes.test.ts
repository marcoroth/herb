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

    const linter = new Linter(Herb, [HTMLAttributeValuesRequireQuotesRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(0)
  })

  test("fails for unquoted attribute values", () => {
    const html = '<div id=hello class=container>'

    const linter = new Linter(Herb, [HTMLAttributeValuesRequireQuotesRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(2) // Both id and class are unquoted
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(2)

    expect(lintResult.offenses[0].rule).toBe("html-attribute-values-require-quotes")
    expect(lintResult.offenses[0].severity).toBe("error")

    expect(lintResult.offenses[0].message).toBe('Attribute value should be quoted: `id="hello"`. Always wrap attribute values in quotes.')
    expect(lintResult.offenses[1].message).toBe('Attribute value should be quoted: `class="container"`. Always wrap attribute values in quotes.')
  })

  test("passes for single-quoted values", () => {
    const html = "<div id='hello' class='container'>"

    const linter = new Linter(Herb, [HTMLAttributeValuesRequireQuotesRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
  })

  test("passes for boolean attributes without values", () => {
    const html = '<input type="text" disabled>'

    const linter = new Linter(Herb, [HTMLAttributeValuesRequireQuotesRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
  })

  test("handles mixed quoted and unquoted", () => {
    const html = '<input type="text" name=username value="test">'

    const linter = new Linter(Herb, [HTMLAttributeValuesRequireQuotesRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1) // Only name is unquoted
    expect(lintResult.offenses[0].message).toBe('Attribute value should be quoted: `name="username"`. Always wrap attribute values in quotes.')
  })

  test("handles ERB in quoted attributes", () => {
    const html = '<div class="<%= classes %>" data-id="<%= item.id %>">'

    const linter = new Linter(Herb, [HTMLAttributeValuesRequireQuotesRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
  })

  test("handles ERB in unquoted attributes", () => {
    const html = '<div class=<%= classes %>'

    const linter = new Linter(Herb, [HTMLAttributeValuesRequireQuotesRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses[0].message).toBe('Attribute value should be quoted: `class="<%= classes %>"`. Always wrap attribute values in quotes.')
  })

  test("handles self-closing tags", () => {
    const html = '<img src=photo.jpg alt="Photo">'

    const linter = new Linter(Herb, [HTMLAttributeValuesRequireQuotesRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.offenses[0].message).toBe('Attribute value should be quoted: `src="photo"`. Always wrap attribute values in quotes.')
  })

  test("handles complex attribute values", () => {
    const html = '<a href="/profile" title=User\\ Profile>'

    const linter = new Linter(Herb, [HTMLAttributeValuesRequireQuotesRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.offenses[0].message).toBe('Attribute value should be quoted: `title="User"`. Always wrap attribute values in quotes.')
  })

  test("ignores closing tags", () => {
    const html = '<div class="test"></div>'

    const linter = new Linter(Herb, [HTMLAttributeValuesRequireQuotesRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
  })
})
