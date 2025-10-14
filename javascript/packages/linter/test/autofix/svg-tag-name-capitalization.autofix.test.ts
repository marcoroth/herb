import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../../src/linter.js"
import { SVGTagNameCapitalizationRule } from "../../src/rules/svg-tag-name-capitalization.js"

describe("svg-tag-name-capitalization autofix", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("fixes lowercase SVG element to camelCase", () => {
    const input = `<svg><lineargradient></lineargradient></svg>`
    const expected = `<svg><linearGradient></linearGradient></svg>`

    const linter = new Linter(Herb, [SVGTagNameCapitalizationRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(2)
    expect(result.unfixed).toHaveLength(0)
  })

  test("fixes multiple SVG elements", () => {
    const input = `<svg><lineargradient></lineargradient><radialgradient></radialgradient></svg>`
    const expected = `<svg><linearGradient></linearGradient><radialGradient></radialGradient></svg>`

    const linter = new Linter(Herb, [SVGTagNameCapitalizationRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(4)
  })

  test("fixes clippath element", () => {
    const input = `<svg><clippath></clippath></svg>`
    const expected = `<svg><clipPath></clipPath></svg>`

    const linter = new Linter(Herb, [SVGTagNameCapitalizationRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(2)
  })

  test("fixes textpath element", () => {
    const input = `<svg><textpath></textpath></svg>`
    const expected = `<svg><textPath></textPath></svg>`

    const linter = new Linter(Herb, [SVGTagNameCapitalizationRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(2)
  })

  test("fixes nested SVG elements", () => {
    const input = `<svg><defs><lineargradient id="grad"><stop /></lineargradient></defs></svg>`
    const expected = `<svg><defs><linearGradient id="grad"><stop /></linearGradient></defs></svg>`

    const linter = new Linter(Herb, [SVGTagNameCapitalizationRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(2)
  })

  test("preserves already correct camelCase elements", () => {
    const input = `<svg><linearGradient></linearGradient></svg>`
    const expected = `<svg><linearGradient></linearGradient></svg>`

    const linter = new Linter(Herb, [SVGTagNameCapitalizationRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(0)
  })

  test("fixes mixed case issues", () => {
    const input = `<svg><LineArGrAdIeNt></LineArGrAdIeNt></svg>`
    const expected = `<svg><linearGradient></linearGradient></svg>`

    const linter = new Linter(Herb, [SVGTagNameCapitalizationRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(2)
  })
})
