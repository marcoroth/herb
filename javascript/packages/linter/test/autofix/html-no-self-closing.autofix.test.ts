import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../../src/linter.js"
import { HTMLNoSelfClosingRule } from "../../src/rules/html-no-self-closing.js"

describe("html-no-self-closing autofix", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("converts self-closing void element", () => {
    const input = '<br />'
    const expected = '<br>'

    const linter = new Linter(Herb, [HTMLNoSelfClosingRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
    expect(result.unfixed).toHaveLength(0)
  })

  test("converts self-closing non-void element to open/close pair", () => {
    const input = '<div />'
    const expected = '<div></div>'

    const linter = new Linter(Herb, [HTMLNoSelfClosingRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
  })

  test("handles multiple void elements", () => {
    const input = '<br /><hr /><img />'
    const expected = '<br><hr><img>'

    const linter = new Linter(Herb, [HTMLNoSelfClosingRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(3)
  })

  test("handles self-closing div with attributes", () => {
    const input = '<div class="test" id="main" />'
    const expected = '<div class="test" id="main"></div>'

    const linter = new Linter(Herb, [HTMLNoSelfClosingRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
  })

  test("handles self-closing input element", () => {
    const input = '<input type="text" />'
    const expected = '<input type="text">'

    const linter = new Linter(Herb, [HTMLNoSelfClosingRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
  })

  test("handles mixed void and non-void elements", () => {
    const input = '<div><br /><span /></div>'
    const expected = '<div><br><span></span></div>'

    const linter = new Linter(Herb, [HTMLNoSelfClosingRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(2)
  })

  test("preserves whitespace before slash", () => {
    const input = '<input type="text" />'
    const expected = '<input type="text">'

    const linter = new Linter(Herb, [HTMLNoSelfClosingRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
  })

  test("does not affect SVG elements", () => {
    const input = '<svg><circle cx="50" cy="50" r="40" /></svg>'

    const linter = new Linter(Herb, [HTMLNoSelfClosingRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(input)
    expect(result.fixed).toHaveLength(0)
  })
})
