import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../../src/linter.js"
import { HTMLAttributeValuesRequireQuotesRule } from "../../src/rules/html-attribute-values-require-quotes.js"

describe("html-attribute-values-require-quotes autofix", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("adds quotes to unquoted attribute value", () => {
    const input = `<div class=container>Content</div>`
    const expected = `<div class="container">Content</div>`

    const linter = new Linter(Herb, [HTMLAttributeValuesRequireQuotesRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
    expect(result.unfixed).toHaveLength(0)
  })

  test("adds quotes to multiple unquoted attributes", () => {
    const input = `<div class=container id=main data-value=test>Content</div>`
    const expected = `<div class="container" id="main" data-value="test">Content</div>`

    const linter = new Linter(Herb, [HTMLAttributeValuesRequireQuotesRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(3)
  })

  test("handles nested elements", () => {
    const input = `<div class=outer><span id=inner>Text</span></div>`
    const expected = `<div class="outer"><span id="inner">Text</span></div>`

    const linter = new Linter(Herb, [HTMLAttributeValuesRequireQuotesRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(2)
  })

  test("preserves already quoted attributes", () => {
    const input = `<div class="quoted" id=unquoted>Content</div>`
    const expected = `<div class="quoted" id="unquoted">Content</div>`

    const linter = new Linter(Herb, [HTMLAttributeValuesRequireQuotesRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
  })

  test("handles numeric values", () => {
    const input = `<input type=text maxlength=100>`
    const expected = `<input type="text" maxlength="100">`

    const linter = new Linter(Herb, [HTMLAttributeValuesRequireQuotesRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(2)
  })
})
