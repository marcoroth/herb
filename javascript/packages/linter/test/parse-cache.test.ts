import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { ParseCache } from "../src/parse-cache.js"
import { isWhitespaceNode } from "@herb-tools/core"
import type { HTMLElementNode } from "@herb-tools/core"

describe("ParseCache", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("returns a ParseResult", () => {
    const cache = new ParseCache(Herb)
    const result = cache.get("<div></div>")

    expect(result).toBeDefined()
    expect(result.value).toBeDefined()
  })

  test("returns the same result for the same source", () => {
    const cache = new ParseCache(Herb)
    const result1 = cache.get("<div></div>")
    const result2 = cache.get("<div></div>")

    expect(result1).toBe(result2)
  })

  test("returns different results for different sources", () => {
    const cache = new ParseCache(Herb)
    const result1 = cache.get("<div></div>")
    const result2 = cache.get("<span></span>")

    expect(result1).not.toBe(result2)
  })

  test("returns different results for different parser options", () => {
    const cache = new ParseCache(Herb)
    const result1 = cache.get("<div></div>")
    const result2 = cache.get("<div></div>", { strict: false })

    expect(result1).not.toBe(result2)
  })

  test("returns the same result for equivalent parser options", () => {
    const cache = new ParseCache(Herb)
    const result1 = cache.get("<div></div>", { strict: false })
    const result2 = cache.get("<div></div>", { strict: false })

    expect(result1).toBe(result2)
  })

  test("clear() removes all cached results", () => {
    const cache = new ParseCache(Herb)
    const result1 = cache.get("<div></div>")

    cache.clear()

    const result2 = cache.get("<div></div>")

    expect(result1).not.toBe(result2)
  })

  describe("resolveOptions", () => {
    test("returns default options when no overrides given", () => {
      const cache = new ParseCache(Herb)
      const options = cache.resolveOptions({})

      expect(options).toEqual({
        track_whitespace: true,
        analyze: true,
        strict: true,
      })
    })

    test("allows overriding strict mode", () => {
      const cache = new ParseCache(Herb)
      const options = cache.resolveOptions({ strict: false })

      expect(options).toEqual({
        track_whitespace: true,
        analyze: true,
        strict: false,
      })
    })

    test("allows overriding track_whitespace", () => {
      const cache = new ParseCache(Herb)
      const options = cache.resolveOptions({ track_whitespace: false })

      expect(options).toEqual({
        track_whitespace: false,
        analyze: true,
        strict: true,
      })
    })

    test("allows overriding multiple options", () => {
      const cache = new ParseCache(Herb)
      const options = cache.resolveOptions({ strict: false, analyze: false })

      expect(options).toEqual({
        track_whitespace: true,
        analyze: false,
        strict: false,
      })
    })
  })

  test("parses with track_whitespace enabled by default", () => {
    const cache = new ParseCache(Herb)
    const result = cache.get("<div></div >")
    const children = result.value.children

    expect(children.length).toBeGreaterThan(0)

    const div = children[0] as HTMLElementNode

    expect(div).toBeDefined()
    expect(div.close_tag).toBeDefined()
    expect(div.close_tag?.childNodes()).toHaveLength(1)
    expect(isWhitespaceNode(div.close_tag?.compactChildNodes()[0])).toBeTruthy()
  })
})
