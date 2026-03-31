import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { isNode, getTagName } from "@herb-tools/core"
import { HTMLTextNode, HTMLElementNode, ERBContentNode } from "@herb-tools/core"

import { TextFlowAnalyzer } from "../src/text-flow-analyzer.js"
import type { TextFlowAnalyzerDelegate } from "../src/text-flow-analyzer.js"

function createMockAnalyzerDelegate(): TextFlowAnalyzerDelegate {
  return {
    tryRenderInlineElement(element: HTMLElementNode): string | null {
      const tagName = getTagName(element)
      const bodyText = element.body
        .filter(child => isNode(child, HTMLTextNode))
        .map(child => (child as HTMLTextNode).content.trim())
        .join("")

      return `<${tagName}>${bodyText}</${tagName}>`
    },

    renderERBAsString(node: ERBContentNode): string {
      const opening = node.tag_opening?.value ?? "<%"
      const content = node.content?.value ?? ""
      const closing = node.tag_closing?.value ?? "%>"

      return `${opening}${content}${closing}`
    },
  }
}

function parseBody(source: string) {
  const result = Herb.parse(source)
  const children = result.value.children
  const element = children[0]

  if (isNode(element, HTMLElementNode)) {
    return element.body
  }

  return children
}

describe("TextFlowAnalyzer", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  describe("processTextNode", () => {
    test("produces a text unit for plain text", () => {
      const analyzer = new TextFlowAnalyzer(createMockAnalyzerDelegate())
      const body = parseBody("<p>Hello world</p>")
      const units = analyzer.buildContentUnits(body)

      expect(units).toHaveLength(1)
      expect(units[0].unit).toEqual({
        type: "text", content: "Hello world", isAtomic: false, breaksFlow: false,
      })
    })

    test("single space text becomes atomic", () => {
      const analyzer = new TextFlowAnalyzer(createMockAnalyzerDelegate())
      const body = parseBody("<p><%= a %> <%= b %></p>")
      const units = analyzer.buildContentUnits(body)

      expect(units).toHaveLength(3)
      expect(units[0].unit).toEqual({
        type: "erb", content: "<%= a %>", isAtomic: true, breaksFlow: false,
      })
      expect(units[1].unit).toEqual({
        type: "text", content: " ", isAtomic: true, breaksFlow: false,
      })
      expect(units[2].unit).toEqual({
        type: "erb", content: "<%= b %>", isAtomic: true, breaksFlow: false,
      })
    })

    test("merges text immediately after atomic ERB unit (no whitespace between)", () => {
      const analyzer = new TextFlowAnalyzer(createMockAnalyzerDelegate())
      const body = parseBody("<p><%= name %>suffix</p>")
      const units = analyzer.buildContentUnits(body)

      expect(units).toHaveLength(1)
      expect(units[0].unit.type).toBe("erb")
      expect(units[0].unit.content).toBe("<%= name %>suffix")
      expect(units[0].unit.isAtomic).toBe(true)
    })

    test("does not merge text after atomic when whitespace separates them", () => {
      const analyzer = new TextFlowAnalyzer(createMockAnalyzerDelegate())
      const body = parseBody("<p><%= name %> suffix</p>")
      const units = analyzer.buildContentUnits(body)

      expect(units).toHaveLength(2)
      expect(units[0].unit.type).toBe("erb")
      expect(units[0].unit.content).toBe("<%= name %>")
      expect(units[1].unit.type).toBe("text")
      expect(units[1].unit.content).toBe(" suffix")
    })

    test("preserves node reference on text unit", () => {
      const analyzer = new TextFlowAnalyzer(createMockAnalyzerDelegate())
      const body = parseBody("<p>Hello</p>")
      const units = analyzer.buildContentUnits(body)

      expect(units).toHaveLength(1)
      expect(units[0].unit.content).toBe("Hello")
      expect(units[0].node).not.toBeNull()
      expect(isNode(units[0].node!, HTMLTextNode)).toBe(true)
    })
  })

  describe("processInlineElement", () => {
    test("produces an atomic inline unit for a simple inline element", () => {
      const analyzer = new TextFlowAnalyzer(createMockAnalyzerDelegate())
      const body = parseBody("<p><em>hello</em></p>")
      const units = analyzer.buildContentUnits(body)

      expect(units).toHaveLength(1)
      expect(units[0].unit).toEqual({
        type: "inline", content: "<em>hello</em>", isAtomic: true, breaksFlow: false,
      })
    })

    test("produces a breaksFlow block unit when delegate returns null", () => {
      const delegate: TextFlowAnalyzerDelegate = {
        tryRenderInlineElement() { return null },
        renderERBAsString() { return "<%= erb %>" },
      }

      const analyzer = new TextFlowAnalyzer(delegate)
      const body = parseBody("<p>Text <em>world</em></p>")
      const units = analyzer.buildContentUnits(body)

      expect(units).toHaveLength(2)
      expect(units[0].unit.type).toBe("text")
      expect(units[1].unit).toEqual({
        type: "block", content: "", isAtomic: false, breaksFlow: true,
      })
    })

    test("merges inline element with preceding text when no whitespace", () => {
      const analyzer = new TextFlowAnalyzer(createMockAnalyzerDelegate())
      const body = parseBody("<p>word<em>x</em></p>")
      const units = analyzer.buildContentUnits(body)

      expect(units).toHaveLength(1)
      expect(units[0].unit.type).toBe("inline")
      expect(units[0].unit.content).toBe("word<em>x</em>")
      expect(units[0].unit.isAtomic).toBe(true)
    })

    test("does not merge inline element when whitespace separates it from preceding text", () => {
      const analyzer = new TextFlowAnalyzer(createMockAnalyzerDelegate())
      const body = parseBody("<p>word <em>x</em></p>")
      const units = analyzer.buildContentUnits(body)

      expect(units).toHaveLength(2)
      expect(units[0].unit.type).toBe("text")
      expect(units[0].unit.content).toBe("word ")
      expect(units[1].unit.type).toBe("inline")
      expect(units[1].unit.content).toBe("<em>x</em>")
    })

    test("preserves node reference to the HTMLElementNode", () => {
      const analyzer = new TextFlowAnalyzer(createMockAnalyzerDelegate())
      const body = parseBody("<p><strong>bold</strong></p>")
      const units = analyzer.buildContentUnits(body)

      expect(units).toHaveLength(1)
      expect(units[0].unit.content).toBe("<strong>bold</strong>")
      expect(isNode(units[0].node!, HTMLElementNode)).toBe(true)
    })
  })

  describe("processERBContentNode", () => {
    test("produces an atomic ERB unit", () => {
      const analyzer = new TextFlowAnalyzer(createMockAnalyzerDelegate())
      const body = parseBody("<p><%= name %></p>")
      const units = analyzer.buildContentUnits(body)

      expect(units).toHaveLength(1)
      expect(units[0].unit).toEqual({
        type: "erb", content: "<%= name %>", isAtomic: true, breaksFlow: false,
      })
    })

    test("herb:disable comments are treated as regular ERB content units", () => {
      const analyzer = new TextFlowAnalyzer(createMockAnalyzerDelegate())
      const body = parseBody("<p>text <%# herb:disable SomeRule %></p>")
      const units = analyzer.buildContentUnits(body)

      expect(units).toHaveLength(2)
      expect(units[0].unit.type).toBe("text")
      expect(units[1].unit.type).toBe("erb")
    })

    test("merges ERB with preceding text when no whitespace", () => {
      const analyzer = new TextFlowAnalyzer(createMockAnalyzerDelegate())
      const body = parseBody("<p>word<%= x %></p>")
      const units = analyzer.buildContentUnits(body)

      expect(units).toHaveLength(1)
      expect(units[0].unit.type).toBe("erb")
      expect(units[0].unit.content).toBe("word<%= x %>")
      expect(units[0].unit.isAtomic).toBe(true)
    })

    test("inserts a space unit between atomic units when whitespace separates them", () => {
      const analyzer = new TextFlowAnalyzer(createMockAnalyzerDelegate())
      const body = parseBody("<p><em>a</em> <%= x %></p>")
      const units = analyzer.buildContentUnits(body)

      expect(units).toHaveLength(3)
      expect(units[0].unit).toEqual({
        type: "inline", content: "<em>a</em>", isAtomic: true, breaksFlow: false,
      })
      expect(units[1].unit).toEqual({
        type: "text", content: " ", isAtomic: true, breaksFlow: false,
      })
      expect(units[2].unit).toEqual({
        type: "erb", content: "<%= x %>", isAtomic: true, breaksFlow: false,
      })
    })

    test("preserves node reference to the ERBContentNode", () => {
      const analyzer = new TextFlowAnalyzer(createMockAnalyzerDelegate())
      const body = parseBody("<p><%= name %></p>")
      const units = analyzer.buildContentUnits(body)

      expect(units).toHaveLength(1)
      expect(units[0].unit.content).toBe("<%= name %>")
      expect(isNode(units[0].node!, ERBContentNode)).toBe(true)
    })
  })

  describe("block elements", () => {
    test("non-inline HTML element produces breaksFlow block unit", () => {
      const analyzer = new TextFlowAnalyzer(createMockAnalyzerDelegate())
      const body = parseBody("<div>text <div>inner</div> more</div>")
      const units = analyzer.buildContentUnits(body)

      expect(units).toHaveLength(3)
      expect(units[0].unit).toEqual({
        type: "text", content: "text ", isAtomic: false, breaksFlow: false,
      })
      expect(units[1].unit).toEqual({
        type: "block", content: "", isAtomic: false, breaksFlow: true,
      })
      expect(units[2].unit).toEqual({
        type: "text", content: " more", isAtomic: false, breaksFlow: false,
      })
    })

    test("block unit preserves node reference", () => {
      const analyzer = new TextFlowAnalyzer(createMockAnalyzerDelegate())
      const body = parseBody("<div>text <div>inner</div></div>")
      const units = analyzer.buildContentUnits(body)

      expect(units).toHaveLength(2)
      expect(units[1].unit.type).toBe("block")
      expect(isNode(units[1].node!, HTMLElementNode)).toBe(true)
    })
  })

  describe("whitespace handling", () => {
    test("skips WhitespaceNode entirely", () => {
      const analyzer = new TextFlowAnalyzer(createMockAnalyzerDelegate())
      const body = parseBody("<p>  \n  </p>")
      const units = analyzer.buildContentUnits(body)

      const blockUnits = units.filter(unit => unit.unit.type === "block")
      expect(blockUnits).toHaveLength(0)
    })

    test("pure whitespace between content nodes becomes a space unit", () => {
      const analyzer = new TextFlowAnalyzer(createMockAnalyzerDelegate())
      const body = parseBody("<p><em>a</em>\n<em>b</em></p>")
      const units = analyzer.buildContentUnits(body)

      expect(units).toHaveLength(3)
      expect(units[0].unit.content).toBe("<em>a</em>")
      expect(units[1].unit).toEqual({
        type: "text", content: " ", isAtomic: true, breaksFlow: false,
      })
      expect(units[2].unit.content).toBe("<em>b</em>")
    })

    test("no trailing space unit when whitespace has no following content", () => {
      const analyzer = new TextFlowAnalyzer(createMockAnalyzerDelegate())
      const body = parseBody("<p><em>a</em>  </p>")
      const units = analyzer.buildContentUnits(body)

      expect(units).toHaveLength(1)
      expect(units[0].unit.type).toBe("inline")
      expect(units[0].unit.content).toBe("<em>a</em>")
    })
  })

  describe("mixed sequences", () => {
    test("text + inline + text produces correct sequence", () => {
      const analyzer = new TextFlowAnalyzer(createMockAnalyzerDelegate())
      const body = parseBody("<p>before <em>mid</em> after</p>")
      const units = analyzer.buildContentUnits(body)

      expect(units).toHaveLength(3)
      expect(units[0].unit).toEqual({
        type: "text", content: "before ", isAtomic: false, breaksFlow: false,
      })
      expect(units[1].unit).toEqual({
        type: "inline", content: "<em>mid</em>", isAtomic: true, breaksFlow: false,
      })
      expect(units[2].unit).toEqual({
        type: "text", content: " after", isAtomic: false, breaksFlow: false,
      })
    })

    test("text + ERB + text produces correct sequence", () => {
      const analyzer = new TextFlowAnalyzer(createMockAnalyzerDelegate())
      const body = parseBody("<p>before <%= x %> after</p>")
      const units = analyzer.buildContentUnits(body)

      expect(units).toHaveLength(3)
      expect(units[0].unit).toEqual({
        type: "text", content: "before ", isAtomic: false, breaksFlow: false,
      })
      expect(units[1].unit).toEqual({
        type: "erb", content: "<%= x %>", isAtomic: true, breaksFlow: false,
      })
      expect(units[2].unit).toEqual({
        type: "text", content: " after", isAtomic: false, breaksFlow: false,
      })
    })

    test("inline + ERB produces two atomic units with space between", () => {
      const analyzer = new TextFlowAnalyzer(createMockAnalyzerDelegate())
      const body = parseBody("<p><em>a</em> <%= x %></p>")
      const units = analyzer.buildContentUnits(body)
      const atomicUnits = units.filter(unit => unit.unit.isAtomic && (unit.unit.type === "inline" || unit.unit.type === "erb"))

      expect(atomicUnits).toHaveLength(2)
      expect(atomicUnits[0].unit.content).toBe("<em>a</em>")
      expect(atomicUnits[1].unit.content).toBe("<%= x %>")
    })

    test("text + block + text produces breaksFlow in the middle", () => {
      const analyzer = new TextFlowAnalyzer(createMockAnalyzerDelegate())
      const body = parseBody("<div>before <div>block</div> after</div>")
      const units = analyzer.buildContentUnits(body)

      expect(units).toHaveLength(3)
      expect(units[0].unit.type).toBe("text")
      expect(units[1].unit.type).toBe("block")
      expect(units[1].unit.breaksFlow).toBe(true)
      expect(units[2].unit.type).toBe("text")
    })

    test("empty input produces empty result", () => {
      const analyzer = new TextFlowAnalyzer(createMockAnalyzerDelegate())
      expect(analyzer.buildContentUnits([])).toEqual([])
    })

    test("multiple ERB nodes produce multiple ERB units", () => {
      const analyzer = new TextFlowAnalyzer(createMockAnalyzerDelegate())
      const body = parseBody("<p><%= a %> <%= b %> <%= c %></p>")
      const units = analyzer.buildContentUnits(body)
      const erbUnits = units.filter(unit => unit.unit.type === "erb")

      expect(erbUnits).toHaveLength(3)
      expect(erbUnits[0].unit.content).toBe("<%= a %>")
      expect(erbUnits[1].unit.content).toBe("<%= b %>")
      expect(erbUnits[2].unit.content).toBe("<%= c %>")
    })

    test("two adjacent inline elements produce two separate inline units", () => {
      const analyzer = new TextFlowAnalyzer(createMockAnalyzerDelegate())
      const body = parseBody("<p><em>a</em><strong>b</strong></p>")
      const units = analyzer.buildContentUnits(body)

      expect(units).toHaveLength(2)
      expect(units[0].unit).toEqual({
        type: "inline", content: "<em>a</em>", isAtomic: true, breaksFlow: false,
      })
      expect(units[1].unit).toEqual({
        type: "inline", content: "<strong>b</strong>", isAtomic: true, breaksFlow: false,
      })
    })
  })

  describe("side effects", () => {
    test("analyzer delegate has no push/visit methods — only serialization", () => {
      const delegate = createMockAnalyzerDelegate()

      expect(typeof delegate.tryRenderInlineElement).toBe("function")
      expect(typeof delegate.renderERBAsString).toBe("function")
      expect((delegate as any).push).toBeUndefined()
      expect((delegate as any).pushWithIndent).toBeUndefined()
      expect((delegate as any).visit).toBeUndefined()
    })

    test("building content units only returns data, no output", () => {
      const calls: string[] = []
      const delegate: TextFlowAnalyzerDelegate = {
        tryRenderInlineElement(element: HTMLElementNode): string | null {
          calls.push("tryRenderInlineElement")
          return `<${getTagName(element)}>x</${getTagName(element)}>`
        },
        renderERBAsString(): string {
          calls.push("renderERBAsString")
          return "<%= erb %>"
        },
      }
      const analyzer = new TextFlowAnalyzer(delegate)
      const body = parseBody("<p>Hello <em>world</em> and <%= name %></p>")

      const units = analyzer.buildContentUnits(body)

      expect(calls.every(call => call === "tryRenderInlineElement" || call === "renderERBAsString")).toBe(true)
      expect(units.length).toBeGreaterThan(0)
    })
  })
})
