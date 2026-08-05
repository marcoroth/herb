import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { isNode, getTagName } from "@herb-tools/core"
import { Node, HTMLTextNode, HTMLElementNode, ERBContentNode } from "@herb-tools/core"

import { TextFlowEngine } from "../src/text-flow-engine.js"
import type { TextFlowDelegate } from "../src/text-flow-engine.js"

function createMockDelegate(options: { indent?: string, maxLineLength?: number } = {}): TextFlowDelegate & { lines: string[], visitedNodes: Node[] } {
  const lines: string[] = []
  const visitedNodes: Node[] = []
  const indent = options.indent ?? "  "
  const maxLineLength = options.maxLineLength ?? 80

  return {
    lines,
    visitedNodes,

    get indent() { return indent },
    get maxLineLength() { return maxLineLength },

    push(line: string) {
      lines.push(line)
    },

    pushWithIndent(line: string) {
      const indentPrefix = line.trim() === "" ? "" : indent
      lines.push(indentPrefix + line)
    },

    renderInlineElementAsString(element: HTMLElementNode): string {
      const tagName = getTagName(element)
      const bodyText = element.body
        .filter(c => isNode(c, HTMLTextNode))
        .map(c => (c as HTMLTextNode).content.trim())
        .join("")

      return `<${tagName}>${bodyText}</${tagName}>`
    },

    renderERBAsString(node: ERBContentNode): string {
      const opening = node.tag_opening?.value ?? "<%"
      const content = node.content?.value ?? ""
      const closing = node.tag_closing?.value ?? "%>"

      return `${opening}${content}${closing}`
    },

    tryRenderInlineElement(element: HTMLElementNode): string | null {
      const tagName = getTagName(element)
      const bodyText = element.body
        .filter(c => isNode(c, HTMLTextNode))
        .map(c => (c as HTMLTextNode).content.trim())
        .join("")

      return `<${tagName}>${bodyText}</${tagName}>`
    },

    visit(node: Node) {
      visitedNodes.push(node)
    }
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

describe("TextFlowEngine", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  describe("isInTextFlowContext", () => {
    test("detects text mixed with inline elements", () => {
      const engine = new TextFlowEngine(createMockDelegate())
      const body = parseBody("<p>Hello <em>world</em></p>")

      expect(engine.isInTextFlowContext(body)).toBe(true)
    })

    test("detects text mixed with ERB", () => {
      const engine = new TextFlowEngine(createMockDelegate())
      const body = parseBody("<p>Hello <%= name %></p>")

      expect(engine.isInTextFlowContext(body)).toBe(true)
    })

    test("rejects text-only content", () => {
      const engine = new TextFlowEngine(createMockDelegate())
      const body = parseBody("<p>Hello world</p>")

      expect(engine.isInTextFlowContext(body)).toBe(false)
    })

    test("rejects content with block elements", () => {
      const engine = new TextFlowEngine(createMockDelegate())
      const body = parseBody("<div>Hello <div>world</div></div>")

      expect(engine.isInTextFlowContext(body)).toBe(false)
    })
  })

  describe("isTextFlowNode", () => {
    test("identifies text nodes", () => {
      const engine = new TextFlowEngine(createMockDelegate())
      const body = parseBody("<p>hello</p>")
      const textNode = body.find(c => isNode(c, HTMLTextNode) && c.content.trim() !== "")

      expect(textNode).toBeDefined()
      expect(engine.isTextFlowNode(textNode!)).toBe(true)
    })

    test("identifies inline elements", () => {
      const engine = new TextFlowEngine(createMockDelegate())
      const body = parseBody("<p><em>text</em></p>")
      const emNode = body.find(c => isNode(c, HTMLElementNode))

      expect(emNode).toBeDefined()
      expect(engine.isTextFlowNode(emNode!)).toBe(true)
    })

    test("identifies ERB nodes", () => {
      const engine = new TextFlowEngine(createMockDelegate())
      const children = Herb.parse("<%= foo %>").value.children
      const erbNode = children.find(c => isNode(c, ERBContentNode))

      expect(erbNode).toBeDefined()
      expect(engine.isTextFlowNode(erbNode!)).toBe(true)
    })
  })

  describe("collectTextFlowRun", () => {
    test("collects text + inline element runs", () => {
      const engine = new TextFlowEngine(createMockDelegate())
      const body = parseBody("<p>Hello <em>world</em> more</p>")
      const run = engine.collectTextFlowRun(body, 0)

      expect(run).not.toBeNull()
      expect(run!.nodes.length).toBeGreaterThanOrEqual(2)
    })

    test("returns null for pure text", () => {
      const engine = new TextFlowEngine(createMockDelegate())
      const body = parseBody("<p>Hello world</p>")
      const run = engine.collectTextFlowRun(body, 0)

      expect(run).toBeNull()
    })
  })

  describe("word wrapping", () => {
    test("wraps long text at maxLineLength boundary", () => {
      const delegate = createMockDelegate({ indent: "  ", maxLineLength: 30 })
      const engine = new TextFlowEngine(delegate)
      const body = parseBody("<p>This is a long text with <em>emphasis</em> included</p>")

      engine.visitTextFlowChildren(body)

      expect(delegate.lines).toEqual([
        "  This is a long text with",
        "  <em>emphasis</em> included",
      ])
    })

    test("keeps short content on a single line", () => {
      const delegate = createMockDelegate({ maxLineLength: 80 })
      const engine = new TextFlowEngine(delegate)
      const body = parseBody("<p>Hi <em>there</em></p>")

      engine.visitTextFlowChildren(body)

      expect(delegate.lines).toEqual(["  Hi <em>there</em>"])
    })

    test("prepends indent to each wrapped line", () => {
      const delegate = createMockDelegate({ indent: "    ", maxLineLength: 30 })
      const engine = new TextFlowEngine(delegate)
      const body = parseBody("<p>Some words here with <em>inline</em> and more words</p>")

      engine.visitTextFlowChildren(body)

      expect(delegate.lines).toEqual([
        "    Some words here with",
        "    <em>inline</em> and more",
        "    words",
      ])
    })

    test("subtracts indent width from available wrap width", () => {
      const delegate = createMockDelegate({ indent: "                    ", maxLineLength: 40 })
      const engine = new TextFlowEngine(delegate)
      const body = parseBody("<p>word1 word2 word3 word4 word5</p>")

      engine.visitTextFlowChildren(body)

      expect(delegate.lines).toEqual([
        "                    word1 word2 word3",
        "                    word4 word5",
      ])
    })

    test("handles empty body gracefully", () => {
      const delegate = createMockDelegate()
      const engine = new TextFlowEngine(delegate)

      engine.visitTextFlowChildren([])

      expect(delegate.lines).toEqual([])
    })

    test("trims trailing space from last word before output", () => {
      const delegate = createMockDelegate({ maxLineLength: 80 })
      const engine = new TextFlowEngine(delegate)
      const body = parseBody("<p>Hello <em>world</em></p>")

      engine.visitTextFlowChildren(body)

      expect(delegate.lines).toEqual(["  Hello <em>world</em>"])
    })
  })

  describe("block element flushing", () => {
    test("flushes words and visits block node when breaksFlow unit encountered", () => {
      const delegate = createMockDelegate()
      const engine = new TextFlowEngine(delegate)
      const body = parseBody("<div>before <div>block</div> after</div>")

      engine.visitTextFlowChildren(body)

      expect(delegate.visitedNodes).toHaveLength(1)
      expect(isNode(delegate.visitedNodes[0], HTMLElementNode)).toBe(true)
      expect(delegate.lines).toEqual(["  before", "  after"])
    })

    test("does not visit non-block inline content", () => {
      const delegate = createMockDelegate()
      const engine = new TextFlowEngine(delegate)
      const body = parseBody("<p>Hello <em>world</em></p>")

      engine.visitTextFlowChildren(body)

      expect(delegate.visitedNodes).toHaveLength(0)
    })
  })

  describe("adjacent inline elements", () => {
    test("renders 2+ adjacent inline elements together via pushWithIndent", () => {
      const delegate = createMockDelegate()
      const engine = new TextFlowEngine(delegate)
      const body = parseBody("<p><em>one</em><strong>two</strong></p>")

      engine.visitTextFlowChildren(body)

      expect(delegate.lines).toEqual(["  <em>one</em><strong>two</strong>"])
    })

    test("renders mixed inline + ERB adjacent elements together", () => {
      const delegate = createMockDelegate()
      const engine = new TextFlowEngine(delegate)
      const body = parseBody("<p><em>one</em><%= x %></p>")

      engine.visitTextFlowChildren(body)

      expect(delegate.lines).toEqual(["  <em>one</em><%= x %>"])
    })

    test("processes remaining children as text flow after adjacent inline group", () => {
      const delegate = createMockDelegate()
      const engine = new TextFlowEngine(delegate)
      const body = parseBody("<p><em>a</em><strong>b</strong> and some text here</p>")

      engine.visitTextFlowChildren(body)

      expect(delegate.lines).toEqual([
        "  <em>a</em><strong>b</strong>",
        "  and some text here",
      ])
    })

    test("single inline element uses text flow path instead of adjacent grouping", () => {
      const delegate = createMockDelegate()
      const engine = new TextFlowEngine(delegate)
      const body = parseBody("<p>Hello <em>world</em> end</p>")

      engine.visitTextFlowChildren(body)

      expect(delegate.lines).toEqual(["  Hello <em>world</em> end"])
    })

    test("punctuation text following adjacent inline elements is merged", () => {
      const delegate = createMockDelegate({ maxLineLength: 80 })
      const engine = new TextFlowEngine(delegate)
      const body = parseBody("<p><em>a</em><strong>b</strong>.</p>")

      engine.visitTextFlowChildren(body)

      expect(delegate.lines).toEqual(["  <em>a</em><strong>b</strong>."])
    })
  })

  describe("text flow rendering", () => {
    test("produces output for text + inline content", () => {
      const delegate = createMockDelegate()
      const engine = new TextFlowEngine(delegate)
      const body = parseBody("<p>Hello <em>world</em></p>")

      engine.visitTextFlowChildren(body)

      expect(delegate.lines).toEqual(["  Hello <em>world</em>"])
    })

    test("produces output for text + ERB content", () => {
      const delegate = createMockDelegate()
      const engine = new TextFlowEngine(delegate)
      const body = parseBody("<p>Hello <%= name %></p>")

      engine.visitTextFlowChildren(body)

      expect(delegate.lines).toEqual(["  Hello <%= name %>"])
    })

    test("handles multiple inline elements in text flow", () => {
      const delegate = createMockDelegate()
      const engine = new TextFlowEngine(delegate)
      const body = parseBody("<p>Text <em>one</em> and <strong>two</strong> end</p>")

      engine.visitTextFlowChildren(body)

      expect(delegate.lines).toEqual(["  Text <em>one</em> and <strong>two</strong> end"])
    })

    test("handles ERB mixed with inline elements", () => {
      const delegate = createMockDelegate()
      const engine = new TextFlowEngine(delegate)
      const body = parseBody("<p>Hello <%= name %> and <em>world</em></p>")

      engine.visitTextFlowChildren(body)

      expect(delegate.lines).toEqual(["  Hello <%= name %> and <em>world</em>"])
    })

    test("atomic units are kept together (not broken mid-tag)", () => {
      const delegate = createMockDelegate({ indent: "  ", maxLineLength: 30 })
      const engine = new TextFlowEngine(delegate)
      const body = parseBody("<p>text <em>longword</em></p>")

      engine.visitTextFlowChildren(body)

      expect(delegate.lines).toEqual(["  text <em>longword</em>"])
    })

    test("closing punctuation is not separated from preceding content", () => {
      const delegate = createMockDelegate({ indent: "  ", maxLineLength: 30 })
      const engine = new TextFlowEngine(delegate)
      const body = parseBody("<p>Some long text that should wrap nicely.</p>")

      engine.visitTextFlowChildren(body)

      expect(delegate.lines).toEqual([
        "  Some long text that should",
        "  wrap nicely.",
      ])
    })
  })

  describe("delegate interface", () => {
    test("TextFlowDelegate extends TextFlowAnalyzerDelegate", () => {
      const delegate = createMockDelegate()

      expect(typeof delegate.tryRenderInlineElement).toBe("function")
      expect(typeof delegate.renderERBAsString).toBe("function")

      expect(typeof delegate.push).toBe("function")
      expect(typeof delegate.pushWithIndent).toBe("function")
      expect(typeof delegate.renderInlineElementAsString).toBe("function")
      expect(typeof delegate.visit).toBe("function")
      expect(typeof delegate.indent).toBe("string")
      expect(typeof delegate.maxLineLength).toBe("number")
    })

    test("all output goes through delegate push/pushWithIndent", () => {
      const pushCalls: string[] = []
      const pushWithIndentCalls: string[] = []

      const delegate: TextFlowDelegate & { lines: string[], visitedNodes: Node[] } = {
        lines: [],
        visitedNodes: [],
        get indent() { return "  " },
        get maxLineLength() { return 80 },
        push(line: string) { pushCalls.push(line); this.lines.push(line) },
        pushWithIndent(line: string) { pushWithIndentCalls.push(line); this.lines.push("  " + line) },
        renderInlineElementAsString(element: HTMLElementNode) {
          return `<${getTagName(element)}>x</${getTagName(element)}>`
        },
        renderERBAsString() { return "<%= x %>" },
        tryRenderInlineElement(element: HTMLElementNode) {
          return `<${getTagName(element)}>x</${getTagName(element)}>`
        },
        visit(node: Node) { this.visitedNodes.push(node) },
      }

      const engine = new TextFlowEngine(delegate)
      const body = parseBody("<p>Hello <em>world</em></p>")

      engine.visitTextFlowChildren(body)

      expect(pushCalls).toEqual(["  Hello <em>x</em>"])
      expect(pushWithIndentCalls).toEqual([])
    })
  })
})
