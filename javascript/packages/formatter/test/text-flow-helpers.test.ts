import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { isNode } from "@herb-tools/core"
import { HTMLTextNode, HTMLElementNode, ERBContentNode, WhitespaceNode } from "@herb-tools/core"

import type { ContentUnitWithNode } from "../src/format-helpers.js"

import {
  isTextFlowNode,
  isTextFlowWhitespace,
  collectTextFlowRun,
  isInTextFlowContext,
  tryMergeTextAfterAtomic,
  tryMergeAtomicAfterText,
  lastUnitEndsWithWhitespace,
  wrapRemainingWords,
  tryMergePunctuationText,
} from "../src/text-flow-helpers.js"

function parseChildren(source: string) {
  const result = Herb.parse(source)
  return result.value.children
}

function parseBody(source: string) {
  const children = parseChildren(source)
  const element = children[0]

  if (isNode(element, HTMLElementNode)) {
    return element.body
  }

  return children
}

describe("text-flow-helpers", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  describe("isTextFlowNode", () => {
    test("returns true for non-empty text nodes", () => {
      const children = parseChildren("hello world")
      const textNode = children.find(c => isNode(c, HTMLTextNode) && c.content.trim() !== "")

      expect(textNode).toBeDefined()
      expect(isTextFlowNode(textNode!)).toBe(true)
    })

    test("returns false for whitespace-only text nodes", () => {
      const body = parseBody("<div>  </div>")
      const wsNode = body.find(c => isNode(c, HTMLTextNode) && c.content.trim() === "")

      if (wsNode) {
        expect(isTextFlowNode(wsNode)).toBe(false)
      }
    })

    test("returns true for ERB content nodes", () => {
      const children = parseChildren("<%= foo %>")
      const erbNode = children.find(c => isNode(c, ERBContentNode))

      expect(erbNode).toBeDefined()
      expect(isTextFlowNode(erbNode!)).toBe(true)
    })

    test("returns true for inline HTML elements", () => {
      const body = parseBody("<p><em>text</em></p>")
      const emNode = body.find(c => isNode(c, HTMLElementNode))

      expect(emNode).toBeDefined()
      expect(isTextFlowNode(emNode!)).toBe(true)
    })

    test("returns false for block HTML elements", () => {
      const body = parseBody("<div><div>text</div></div>")
      const innerDiv = body.find(c => isNode(c, HTMLElementNode))

      expect(innerDiv).toBeDefined()
      expect(isTextFlowNode(innerDiv!)).toBe(false)
    })
  })

  describe("isTextFlowWhitespace", () => {
    test("returns true for WhitespaceNode", () => {
      const body = parseBody("<p><em>a</em> <strong>b</strong></p>")
      const wsNode = body.find(c => isNode(c, WhitespaceNode))

      if (wsNode) {
        expect(isTextFlowWhitespace(wsNode)).toBe(true)
      }
    })

    test("returns true for single-newline whitespace text nodes", () => {
      const body = parseBody("<p>\n<em>a</em></p>")
      const wsTextNode = body.find(c => isNode(c, HTMLTextNode) && c.content.trim() === "" && !c.content.includes('\n\n'))

      if (wsTextNode) {
        expect(isTextFlowWhitespace(wsTextNode)).toBe(true)
      }
    })

    test("returns false for double-newline text nodes", () => {
      const body = parseBody("<p>\n\n<em>a</em></p>")
      const doubleNewlineNode = body.find(c => isNode(c, HTMLTextNode) && c.content.includes('\n\n'))

      if (doubleNewlineNode) {
        expect(isTextFlowWhitespace(doubleNewlineNode)).toBe(false)
      }
    })
  })

  describe("isInTextFlowContext", () => {
    test("returns true for text mixed with inline elements", () => {
      const body = parseBody("<p>Hello <em>world</em></p>")
      expect(isInTextFlowContext(body)).toBe(true)
    })

    test("returns true for text mixed with ERB", () => {
      const body = parseBody("<p>Hello <%= name %></p>")
      expect(isInTextFlowContext(body)).toBe(true)
    })

    test("returns false for text-only content", () => {
      const body = parseBody("<p>Hello world</p>")
      expect(isInTextFlowContext(body)).toBe(false)
    })

    test("returns false for block elements mixed with text", () => {
      const body = parseBody("<div>Hello <div>world</div></div>")
      expect(isInTextFlowContext(body)).toBe(false)
    })

    test("returns false for no text content", () => {
      const body = parseBody("<div><em>only inline</em></div>")
      expect(isInTextFlowContext(body)).toBe(false)
    })
  })

  describe("collectTextFlowRun", () => {
    test("collects a run of text + inline elements", () => {
      const body = parseBody("<p>Hello <em>world</em> text</p>")
      const run = collectTextFlowRun(body, 0)

      expect(run).not.toBeNull()
      expect(run!.nodes.length).toBeGreaterThanOrEqual(2)
      expect(run!.endIndex).toBeGreaterThan(0)
    })

    test("collects a run of text + ERB nodes", () => {
      const body = parseBody("<p>Hello <%= name %> text</p>")
      const run = collectTextFlowRun(body, 0)

      expect(run).not.toBeNull()
      expect(run!.nodes.length).toBeGreaterThanOrEqual(2)
    })

    test("returns null for text-only content", () => {
      const body = parseBody("<p>Hello world</p>")
      const run = collectTextFlowRun(body, 0)

      expect(run).toBeNull()
    })

    test("returns null for a single text node", () => {
      const body = parseBody("<p>hello</p>")
      const run = collectTextFlowRun(body, 0)

      expect(run).toBeNull()
    })

    test("includes whitespace between flow nodes", () => {
      const body = parseBody("<p>Hello <em>world</em> more</p>")
      const run = collectTextFlowRun(body, 0)

      expect(run).not.toBeNull()
      expect(run!.nodes.length).toBeGreaterThanOrEqual(3)
    })
  })


  describe("tryMergeTextAfterAtomic", () => {
    test("merges first word of text into preceding atomic unit", () => {
      const children = parseChildren("hello")
      const textNode = children.find(c => isNode(c, HTMLTextNode)) as any

      const result: ContentUnitWithNode[] = [{
        unit: { content: '<%= tag %>', type: 'erb', isAtomic: true, breaksFlow: false },
        node: null
      }]

      const fakeTextNode = { ...textNode, content: "text more" }
      const merged = tryMergeTextAfterAtomic(result, fakeTextNode)

      expect(merged).toBe(true)
      expect(result[0].unit.content).toBe('<%= tag %>text')
      expect(result.length).toBe(2)
      expect(result[1].unit.content).toBe('more')
    })

    test("still merges when raw content has leading space (normalizeAndSplitWords trims)", () => {
      const children = parseChildren("hello")
      const textNode = children.find(c => isNode(c, HTMLTextNode)) as any

      const result: ContentUnitWithNode[] = [{
        unit: { content: '<%= tag %>', type: 'erb', isAtomic: true, breaksFlow: false },
        node: null
      }]

      const fakeTextNode = { ...textNode, content: " text" }
      const merged = tryMergeTextAfterAtomic(result, fakeTextNode)

      expect(merged).toBe(true)
      expect(result[0].unit.content).toBe('<%= tag %>text')
    })

    test("does not merge when last unit is not atomic", () => {
      const children = parseChildren("hello")
      const textNode = children.find(c => isNode(c, HTMLTextNode)) as any

      const result: ContentUnitWithNode[] = [{
        unit: { content: 'some text', type: 'text', isAtomic: false, breaksFlow: false },
        node: null
      }]

      const fakeTextNode = { ...textNode, content: "more" }
      const merged = tryMergeTextAfterAtomic(result, fakeTextNode)

      expect(merged).toBe(false)
    })

    test("returns false for empty result array", () => {
      const children = parseChildren("hello")
      const textNode = children.find(c => isNode(c, HTMLTextNode)) as any

      const result: ContentUnitWithNode[] = []
      const merged = tryMergeTextAfterAtomic(result, textNode)

      expect(merged).toBe(false)
    })
  })

  describe("tryMergeAtomicAfterText", () => {
    test("merges atomic content with last word of preceding text", () => {
      const children = parseChildren("hello world")
      const textNode = children[0]

      const result: ContentUnitWithNode[] = [{
        unit: { content: 'hello world', type: 'text', isAtomic: false, breaksFlow: false },
        node: textNode
      }]

      const merged = tryMergeAtomicAfterText(result, children, 0, '<%= tag %>', 'erb', textNode)

      expect(merged).toBe(true)
      expect(result.length).toBe(2)
      expect(result[0].unit.content).toBe('hello')
      expect(result[0].unit.type).toBe('text')
      expect(result[1].unit.content).toBe('world<%= tag %>')
      expect(result[1].unit.type).toBe('erb')
      expect(result[1].unit.isAtomic).toBe(true)
    })

    test("does not merge when last unit is atomic", () => {
      const children = parseChildren("hello")

      const result: ContentUnitWithNode[] = [{
        unit: { content: '<em>text</em>', type: 'inline', isAtomic: true, breaksFlow: false },
        node: null
      }]

      const merged = tryMergeAtomicAfterText(result, children, 0, '<%= tag %>', 'erb', children[0])

      expect(merged).toBe(false)
    })

    test("returns false for empty result array", () => {
      const children = parseChildren("hello")
      const result: ContentUnitWithNode[] = []
      const merged = tryMergeAtomicAfterText(result, children, 0, '<%= tag %>', 'erb', children[0])

      expect(merged).toBe(false)
    })
  })

  describe("lastUnitEndsWithWhitespace", () => {
    test("returns true when last text unit ends with space", () => {
      const result: ContentUnitWithNode[] = [{
        unit: { content: 'hello ', type: 'text', isAtomic: false, breaksFlow: false },
        node: null
      }]

      expect(lastUnitEndsWithWhitespace(result)).toBe(true)
    })

    test("returns false when last text unit does not end with space", () => {
      const result: ContentUnitWithNode[] = [{
        unit: { content: 'hello', type: 'text', isAtomic: false, breaksFlow: false },
        node: null
      }]

      expect(lastUnitEndsWithWhitespace(result)).toBe(false)
    })

    test("returns false when last unit is not text type", () => {
      const result: ContentUnitWithNode[] = [{
        unit: { content: '<%= foo %> ', type: 'erb', isAtomic: true, breaksFlow: false },
        node: null
      }]

      expect(lastUnitEndsWithWhitespace(result)).toBe(false)
    })

    test("returns false for empty array", () => {
      expect(lastUnitEndsWithWhitespace([])).toBe(false)
    })
  })

  describe("wrapRemainingWords", () => {
    test("wraps words within width", () => {
      const lines = wrapRemainingWords(["hello", "world"], 80, "  ")
      expect(lines).toEqual(["  hello world"])
    })

    test("wraps to multiple lines when exceeding width", () => {
      const lines = wrapRemainingWords(["aaaa", "bbbb", "cccc"], 10, "  ")
      expect(lines).toEqual(["  aaaa bbbb", "  cccc"])
    })

    test("handles single word", () => {
      const lines = wrapRemainingWords(["hello"], 80, "    ")
      expect(lines).toEqual(["    hello"])
    })

    test("handles empty input", () => {
      const lines = wrapRemainingWords([], 80, "  ")
      expect(lines).toEqual([])
    })

    test("each word on its own line when very narrow", () => {
      const lines = wrapRemainingWords(["hello", "world", "test"], 5, "")
      expect(lines).toEqual(["hello", "world", "test"])
    })

    test("respects indent in width calculation", () => {
      const lines = wrapRemainingWords(["aaaa", "bbbb", "cccc"], 10, "    ")
      expect(lines).toEqual(["    aaaa bbbb", "    cccc"])
    })
  })

  describe("tryMergePunctuationText", () => {
    test("merges punctuation when combined fits within width", () => {
      const result = tryMergePunctuationText("<%= tag %>", ". More text", 80, "  ")

      expect(result.mergedContent).toBe("<%= tag %>. More text")
      expect(result.shouldStop).toBe(false)
      expect(result.wrappedLines).toEqual([])
    })

    test("attaches punctuation even when rest overflows", () => {
      const result = tryMergePunctuationText("<%= tag %>", ". overflow", 15, "  ")

      expect(result.mergedContent).toContain("<%= tag %>.")
      expect(result.shouldStop).toBe(true)
    })

    test("does not merge non-punctuation text that overflows", () => {
      const result = tryMergePunctuationText("<%= tag %>", "not punctuation", 15, "  ")

      expect(result.mergedContent).toBe("<%= tag %>")
      expect(result.shouldStop).toBe(false)
    })

    test("handles punctuation-only text", () => {
      const result = tryMergePunctuationText("<%= tag %>", ".", 80, "  ")

      expect(result.mergedContent).toBe("<%= tag %>.")
      expect(result.shouldStop).toBe(false)
      expect(result.wrappedLines).toEqual([])
    })

    test("wraps remaining words after punctuation", () => {
      const result = tryMergePunctuationText(
        "a".repeat(70),
        ". word1 word2 word3",
        80,
        "  "
      )

      expect(result.mergedContent).toContain(".")
      expect(result.shouldStop).toBe(true)
      expect(result.wrappedLines.length).toBeGreaterThan(0)
    })

    test("handles multiple punctuation characters", () => {
      const result = tryMergePunctuationText("<%= tag %>", "!? More text", 80, "  ")

      expect(result.mergedContent).toBe("<%= tag %>!? More text")
      expect(result.shouldStop).toBe(false)
    })
  })
})
