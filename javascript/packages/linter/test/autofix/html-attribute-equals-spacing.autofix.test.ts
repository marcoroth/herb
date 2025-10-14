import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../../src/linter.js"
import { HTMLAttributeEqualsSpacingRule } from "../../src/rules/html-attribute-equals-spacing.js"

describe("html-attribute-equals-spacing autofix", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("removes space before equals", () => {
    const input = `<div class ="container">Content</div>`
    const expected = `<div class="container">Content</div>`

    const linter = new Linter(Herb, [HTMLAttributeEqualsSpacingRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
    expect(result.unfixed).toHaveLength(0)
  })

  test("removes space after equals", () => {
    const input = `<div class= "container">Content</div>`
    const expected = `<div class="container">Content</div>`

    const linter = new Linter(Herb, [HTMLAttributeEqualsSpacingRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
  })

  test("removes spaces on both sides of equals", () => {
    const input = `<div class = "container">Content</div>`
    const expected = `<div class="container">Content</div>`

    const linter = new Linter(Herb, [HTMLAttributeEqualsSpacingRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(2)
  })

  test("handles multiple attributes", () => {
    const input = `<div class ="outer" id= "main">Content</div>`
    const expected = `<div class="outer" id="main">Content</div>`

    const linter = new Linter(Herb, [HTMLAttributeEqualsSpacingRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed.length).toBeGreaterThanOrEqual(2)
  })

  test("handles nested elements", () => {
    const input = `<div class ="outer"><span id= "inner">Text</span></div>`
    const expected = `<div class="outer"><span id="inner">Text</span></div>`

    const linter = new Linter(Herb, [HTMLAttributeEqualsSpacingRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(2)
  })
})
