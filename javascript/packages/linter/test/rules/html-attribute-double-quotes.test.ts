import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../../src/linter.js"
import { HTMLAttributeDoubleQuotesRule } from "../../src/rules/html-attribute-double-quotes.js"

describe("html-attribute-double-quotes", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("passes for double quoted attributes", () => {
    const html = '<input type="text" value="Username">'

    const linter = new Linter(Herb, [HTMLAttributeDoubleQuotesRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(0)
  })

  test("fails for single quoted attributes", () => {
    const html = "<input type='text' value='Username'>"

    const linter = new Linter(Herb, [HTMLAttributeDoubleQuotesRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(2)
    expect(lintResult.offenses).toHaveLength(2)

    expect(lintResult.offenses[0].rule).toBe("html-attribute-double-quotes")
    expect(lintResult.offenses[0].message).toBe('Attribute `type` uses single quotes. Prefer double quotes for HTML attribute values: `type="text"`.')
    expect(lintResult.offenses[0].severity).toBe("warning")

    expect(lintResult.offenses[1].rule).toBe("html-attribute-double-quotes")
    expect(lintResult.offenses[1].message).toBe('Attribute `value` uses single quotes. Prefer double quotes for HTML attribute values: `value="Username"`.')
    expect(lintResult.offenses[1].severity).toBe("warning")
  })

  test("passes for mixed content with double quotes", () => {
    const html = '<a href="/profile" title="User Profile" data-controller="dropdown">Profile</a>'

    const linter = new Linter(Herb, [HTMLAttributeDoubleQuotesRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
  })

  test("fails for mixed content with single quotes", () => {
    const html = "<a href='/profile' title='User Profile' data-controller='dropdown'>Profile</a>"

    const linter = new Linter(Herb, [HTMLAttributeDoubleQuotesRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(3)
    expect(lintResult.offenses[0].message).toBe('Attribute `href` uses single quotes. Prefer double quotes for HTML attribute values: `href="/profile"`.')
    expect(lintResult.offenses[1].message).toBe('Attribute `title` uses single quotes. Prefer double quotes for HTML attribute values: `title="User Profile"`.')
    expect(lintResult.offenses[2].message).toBe('Attribute `data-controller` uses single quotes. Prefer double quotes for HTML attribute values: `data-controller="dropdown"`.')
  })

  test("passes for unquoted attributes (handled by other rule)", () => {
    const html = '<input type=text value=Username>'

    const linter = new Linter(Herb, [HTMLAttributeDoubleQuotesRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
  })

  test("passes for attributes without values", () => {
    const html = '<input type="checkbox" checked disabled>'

    const linter = new Linter(Herb, [HTMLAttributeDoubleQuotesRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
  })

  test("handles self-closing tags with single quotes", () => {
    const html = "<img src='/image.jpg' alt='Description' />"

    const linter = new Linter(Herb, [HTMLAttributeDoubleQuotesRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(2)
    expect(lintResult.offenses[0].message).toBe('Attribute `src` uses single quotes. Prefer double quotes for HTML attribute values: `src="/image.jpg"`.')
    expect(lintResult.offenses[1].message).toBe('Attribute `alt` uses single quotes. Prefer double quotes for HTML attribute values: `alt="Description"`.')
  })

  test("handles ERB with single quoted attributes", () => {
    const html = "<div data-controller='<%= controller_name %>' data-action='click->toggle#action'>Content</div>"

    const linter = new Linter(Herb, [HTMLAttributeDoubleQuotesRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(2)
    expect(lintResult.offenses[0].message).toBe('Attribute `data-controller` uses single quotes. Prefer double quotes for HTML attribute values: `data-controller="<%= controller_name %>"`.')
    expect(lintResult.offenses[1].message).toBe('Attribute `data-action` uses single quotes. Prefer double quotes for HTML attribute values: `data-action="click->toggle#action"`.')
  })

  test("handles mixed ERB with single quoted attributes", () => {
    const html = "<div class='static <%= class_list %> another-static'>Content</div>"

    const linter = new Linter(Herb, [HTMLAttributeDoubleQuotesRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(1)
    expect(lintResult.offenses[0].message).toBe('Attribute `class` uses single quotes. Prefer double quotes for HTML attribute values: `class="static <%= class_list %> another-static"`.')
  })

  test("allows single quotes when value contains double quotes", () => {
    const html = `<div id='"hello"' class='Say "Hello" to the world'></div>`

    const linter = new Linter(Herb, [HTMLAttributeDoubleQuotesRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(0)
  })

  test("allows single quotes when value contains double quotes and ERB content", () => {
    const html = `<div class='Say "Hello" to <%= name %>'></div>`

    const linter = new Linter(Herb, [HTMLAttributeDoubleQuotesRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(0)
  })

  test("still fails for single quotes when value has no double quotes", () => {
    const html = "<div id='hello' class='world'></div>"

    const linter = new Linter(Herb, [HTMLAttributeDoubleQuotesRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(2)
    expect(lintResult.offenses[0].message).toBe('Attribute `id` uses single quotes. Prefer double quotes for HTML attribute values: `id="hello"`.')
    expect(lintResult.offenses[1].message).toBe('Attribute `class` uses single quotes. Prefer double quotes for HTML attribute values: `class="world"`.')
  })
})
