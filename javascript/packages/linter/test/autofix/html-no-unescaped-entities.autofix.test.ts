import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../../src/linter.js"
import { HTMLNoUnescapedEntitiesRule } from "../../src/rules/html-no-unescaped-entities.js"

describe("html-no-unescaped-entities autofix", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("replaces bare & in text content", () => {
    const input = '<div>Tom & Jerry</div>'
    const expected = '<div>Tom &amp; Jerry</div>'

    const linter = new Linter(Herb, [HTMLNoUnescapedEntitiesRule])
    const result = linter.autofix(input, undefined, undefined, { includeUnsafe: true })

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
    expect(result.unfixed).toHaveLength(0)
  })

  test("replaces < and > in attribute value", () => {
    const input = '<div data-html="<br>"></div>'
    const expected = '<div data-html="&lt;br&gt;"></div>'

    const linter = new Linter(Herb, [HTMLNoUnescapedEntitiesRule])
    const result = linter.autofix(input, undefined, undefined, { includeUnsafe: true })

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(2)
  })

  test("replaces bare & in attribute value", () => {
    const input = '<a href="/path?a=1&b=2">Link</a>'
    const expected = '<a href="/path?a=1&amp;b=2">Link</a>'

    const linter = new Linter(Herb, [HTMLNoUnescapedEntitiesRule])
    const result = linter.autofix(input, undefined, undefined, { includeUnsafe: true })

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
  })

  test("replaces multiple unescaped characters in one attribute", () => {
    const input = '<div data-html="<b>bold & italic</b>"></div>'
    const expected = '<div data-html="&lt;b&gt;bold &amp; italic&lt;/b&gt;"></div>'

    const linter = new Linter(Herb, [HTMLNoUnescapedEntitiesRule])
    const result = linter.autofix(input, undefined, undefined, { includeUnsafe: true })

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(5)
  })

  test("replaces multiple bare & in text content", () => {
    const input = '<div>a &amp; b & c & d</div>'
    const expected = '<div>a &amp; b &amp; c &amp; d</div>'

    const linter = new Linter(Herb, [HTMLNoUnescapedEntitiesRule])
    const result = linter.autofix(input, undefined, undefined, { includeUnsafe: true })

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(2)
  })

  test("does not fix without includeUnsafe", () => {
    const input = '<div>Tom & Jerry</div>'

    const linter = new Linter(Herb, [HTMLNoUnescapedEntitiesRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(input)
    expect(result.fixed).toHaveLength(0)
    expect(result.unfixed).toHaveLength(1)
  })

  test("does not modify content inside script elements", () => {
    const input = '<script>var x = a & b;</script>'

    const linter = new Linter(Herb, [HTMLNoUnescapedEntitiesRule])
    const result = linter.autofix(input, undefined, undefined, { includeUnsafe: true })

    expect(result.source).toBe(input)
    expect(result.fixed).toHaveLength(0)
  })

  test("preserves already-escaped entities", () => {
    const input = '<div>a &amp; b & c</div>'
    const expected = '<div>a &amp; b &amp; c</div>'

    const linter = new Linter(Herb, [HTMLNoUnescapedEntitiesRule])
    const result = linter.autofix(input, undefined, undefined, { includeUnsafe: true })

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
  })
})
