import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { createAutofixTest } from "../helpers/autofix-test-helper.js"
import { HTMLNoUnescapedEntitiesRule } from "../../src/rules/html-no-unescaped-entities.js"

describe("html-no-unescaped-entities autofix", () => {
  const { unsafeAutofix } = createAutofixTest(HTMLNoUnescapedEntitiesRule)

  beforeAll(async () => {
    await Herb.load()
  })

  test("replaces bare & in text content", () => {
    const input = '<div>Tom & Jerry</div>'
    const expected = '<div>Tom &amp; Jerry</div>'

    const result = unsafeAutofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
    expect(result.unfixed).toHaveLength(0)
  })

  test("does not modify attribute values", () => {
    const input = '<div data-html="<br>"></div>'

    const result = unsafeAutofix(input)

    expect(result.source).toBe(input)
    expect(result.fixed).toHaveLength(0)
  })

  test("does not modify bare & in attribute value", () => {
    const input = '<a href="/path?a=1&b=2">Link</a>'

    const result = unsafeAutofix(input)

    expect(result.source).toBe(input)
    expect(result.fixed).toHaveLength(0)
  })

  test("replaces multiple bare & in text content", () => {
    const input = '<div>a &amp; b & c & d</div>'
    const expected = '<div>a &amp; b &amp; c &amp; d</div>'

    const result = unsafeAutofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(2)
  })

  test("does not fix without includeUnsafe", () => {
    const input = '<div>Tom & Jerry</div>'

    const result = autofix(input)

    expect(result.source).toBe(input)
    expect(result.fixed).toHaveLength(0)
    expect(result.unfixed).toHaveLength(1)
  })

  test("does not modify content inside script elements", () => {
    const input = '<script>var x = a & b;</script>'

    const result = unsafeAutofix(input)

    expect(result.source).toBe(input)
    expect(result.fixed).toHaveLength(0)
  })

  test("preserves already-escaped entities", () => {
    const input = '<div>a &amp; b & c</div>'
    const expected = '<div>a &amp; b &amp; c</div>'

    const result = unsafeAutofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
  })
})
