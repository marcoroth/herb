import dedent from "dedent"
import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../../src/linter.js"
import { HTMLAttributeDoubleQuotesRule } from "../../src/rules/html-attribute-double-quotes.js"

describe("html-attribute-double-quotes autofix", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("converts single quotes to double quotes", () => {
    const input = `<div class='container'>Content</div>`
    const expected = `<div class="container">Content</div>`

    const linter = new Linter(Herb, [HTMLAttributeDoubleQuotesRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
    expect(result.unfixed).toHaveLength(0)
  })

  test("converts multiple attributes with single quotes", () => {
    const input = `<div class='container' id='main' data-value='test'>Content</div>`
    const expected = `<div class="container" id="main" data-value="test">Content</div>`

    const linter = new Linter(Herb, [HTMLAttributeDoubleQuotesRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(3)
  })

  test("handles nested elements", () => {
    const input = `<div class='outer'><span class='inner'>Text</span></div>`
    const expected = `<div class="outer"><span class="inner">Text</span></div>`

    const linter = new Linter(Herb, [HTMLAttributeDoubleQuotesRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(2)
  })

  test("preserves content with special characters", () => {
    const input = `<div data-text='Hello, World!'>Content</div>`
    const expected = `<div data-text="Hello, World!">Content</div>`

    const linter = new Linter(Herb, [HTMLAttributeDoubleQuotesRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
  })

  test("handles multiple lines", () => {
    const input = dedent`
      <div class='line1'>
            <span id='line2'>Text</span>
        </div>
    `

    const expected = dedent`
      <div class="line1">
            <span id="line2">Text</span>
        </div>
    `

    const linter = new Linter(Herb, [HTMLAttributeDoubleQuotesRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(2)
  })
})
