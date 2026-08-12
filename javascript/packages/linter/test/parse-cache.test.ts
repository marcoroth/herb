import { describe, test, expect, beforeAll, vi } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { ParseCache, MAX_ENTRIES } from "../src/parse-cache.js"
import { Linter } from "../src/linter.js"
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

  test("evicts the oldest entry once it is full", () => {
    const cache = new ParseCache(Herb)
    const oldest = cache.get("<div>0</div>")

    for (let index = 1; index <= MAX_ENTRIES; index++) {
      cache.get(`<div>${index}</div>`)
    }

    expect(cache.get("<div>0</div>")).not.toBe(oldest)
    expect(cache.get(`<div>${MAX_ENTRIES}</div>`)).toBe(cache.get(`<div>${MAX_ENTRIES}</div>`))
  })

  test("keeps an entry alive while it is being used", () => {
    const cache = new ParseCache(Herb)
    const kept = cache.get("<div>kept</div>")

    for (let index = 1; index <= MAX_ENTRIES; index++) {
      cache.get(`<div>${index}</div>`)
      cache.get("<div>kept</div>")
    }

    expect(cache.get("<div>kept</div>")).toBe(kept)
  })

  describe("getMutable", () => {
    test("returns an equivalent result", () => {
      const cache = new ParseCache(Herb)
      const cached = cache.get("<div>hello</div>")
      const mutable = cache.getMutable("<div>hello</div>")

      expect(mutable).not.toBe(cached)
      expect(mutable.source).toBe(cached.source)
      expect(mutable.options).toEqual(cached.options)
      expect(mutable.value.inspect()).toBe(cached.value.inspect())
    })

    test("returns a tree that is independent of the cached one", () => {
      const cache = new ParseCache(Herb)
      const cached = cache.get("<div>hello</div>")
      const mutable = cache.getMutable("<div>hello</div>")

      expect(mutable.value).not.toBe(cached.value)

      const tree = cached.value.inspect()

      ;(mutable.value as any).children = []

      expect(cached.value.inspect()).toBe(tree)
      expect(cache.get("<div>hello</div>")).toBe(cached)
    })

    test("returns a fresh copy on every call", () => {
      const cache = new ParseCache(Herb)

      expect(cache.getMutable("<div>hello</div>").value).not.toBe(cache.getMutable("<div>hello</div>").value)
    })
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
        prism_nodes: false,
        prism_nodes_deep: false,
        prism_program: false,
        render_nodes: false,
        strict: true,
        strict_locals: false,
        iteration_nodes: false,
        action_view_helpers: false,
        dot_notation_tags: false,
        transform_conditionals: false,
        html: true,
        timeout: 1000,
        max_errors: 25,
      })
    })

    test("allows overriding strict mode", () => {
      const cache = new ParseCache(Herb)
      const options = cache.resolveOptions({ strict: false })

      expect(options).toEqual({
        track_whitespace: true,
        analyze: true,
        prism_nodes: false,
        prism_nodes_deep: false,
        prism_program: false,
        render_nodes: false,
        strict: false,
        strict_locals: false,
        iteration_nodes: false,
        action_view_helpers: false,
        dot_notation_tags: false,
        transform_conditionals: false,
        html: true,
        timeout: 1000,
        max_errors: 25,
      })
    })

    test("allows overriding track_whitespace", () => {
      const cache = new ParseCache(Herb)
      const options = cache.resolveOptions({ track_whitespace: false })

      expect(options).toEqual({
        track_whitespace: false,
        analyze: true,
        prism_nodes: false,
        prism_nodes_deep: false,
        prism_program: false,
        render_nodes: false,
        strict: true,
        strict_locals: false,
        iteration_nodes: false,
        action_view_helpers: false,
        dot_notation_tags: false,
        transform_conditionals: false,
        html: true,
        timeout: 1000,
        max_errors: 25,
      })
    })

    test("allows overriding multiple options", () => {
      const cache = new ParseCache(Herb)
      const options = cache.resolveOptions({ strict: false, analyze: false })

      expect(options).toEqual({
        track_whitespace: true,
        analyze: false,
        prism_nodes: false,
        prism_nodes_deep: false,
        prism_program: false,
        render_nodes: false,
        strict: false,
        strict_locals: false,
        iteration_nodes: false,
        action_view_helpers: false,
        dot_notation_tags: false,
        transform_conditionals: false,
        html: true,
        timeout: 1000,
        max_errors: 25,
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

  describe("lifetime within a Linter", () => {
    const first = "<SPAN>first</SPAN>"
    const second = "<SPAN>second</SPAN>"

    const cacheOf = (linter: Linter) => (linter as any).parseCache as ParseCache

    test("keeps the previous source after another lint()", () => {
      const linter = new Linter(Herb)
      const cache = cacheOf(linter)

      linter.lint(first)

      const cachedFirst = cache.get(first)

      linter.lint(second)

      expect(cache.get(first)).toBe(cachedFirst)
    })

    test("keeps the previous source after another autofix()", () => {
      const linter = new Linter(Herb)
      const cache = cacheOf(linter)

      linter.autofix(first)

      const cachedFirst = cache.get(first)

      linter.autofix(second)

      expect(cache.get(first)).toBe(cachedFirst)
    })

    test("doesn't re-parse a source it has already linted", () => {
      const linter = new Linter(Herb)

      linter.lint(first)

      const parseSpy = vi.spyOn(Herb, "parse")

      try {
        linter.lint(first)

        expect(parseSpy).not.toHaveBeenCalled()
      } finally {
        parseSpy.mockRestore()
      }
    })

    test("doesn't serve the mutated AST of a previous autofix() to lint()", () => {
      const source = `<div class='foo'   id=''>\n<img src="logo.png">\n</div>\n`
      const linter = new Linter(Herb)

      const before = linter.lint(source).offenses.map(offense => offense.rule)

      linter.autofix(source)

      expect(linter.lint(source).offenses.map(offense => offense.rule)).toEqual(before)
    })

    test("doesn't serve the mutated AST of a previous autofix() to another autofix()", () => {
      const source = `<div class='foo'   id=''>\n<img src="logo.png">\n</div>\n`
      const linter = new Linter(Herb)

      const first = linter.autofix(source)
      const second = linter.autofix(source)

      expect(second.source).toBe(first.source)
      expect(second.fixed.map(offense => offense.rule)).toEqual(first.fixed.map(offense => offense.rule))
    })

    test("still reuses parse results across rules within a single lint()", () => {
      const linter = new Linter(Herb)
      const parseSpy = vi.spyOn(Herb, "parse")

      try {
        linter.lint("<div>hello</div>")

        expect(parseSpy.mock.calls.length).toBeGreaterThan(0)
        expect(parseSpy.mock.calls.length).toBeLessThan(linter.getRuleCount())
      } finally {
        parseSpy.mockRestore()
      }
    })
  })
})
