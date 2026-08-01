import { describe, test, expect, beforeAll } from "vitest"
import { isHTMLElementNode, isHTMLTextNode, isHTMLCommentNode } from "@herb-tools/core"

import { Herb } from "../src"

import type { Node, DocumentNode, HTMLElementNode } from "../src/index.js"

interface ASTEntry {
  path: number[]
  kind: "element" | "text" | "comment"
  tagName?: string
  content?: string
}

function collectEntries(node: DocumentNode | HTMLElementNode, basePath: number[] = []): ASTEntry[] {
  const children: Node[] = isHTMLElementNode(node as Node) ? (node as HTMLElementNode).body : (node as DocumentNode).children
  const entries: ASTEntry[] = []

  children.forEach((child, index) => {
    const path = [...basePath, index]

    if (isHTMLElementNode(child)) {
      entries.push({ path, kind: "element", tagName: child.tag_name?.value?.toLowerCase() })
      entries.push(...collectEntries(child, path))
    } else if (isHTMLTextNode(child)) {
      entries.push({ path, kind: "text", content: child.content })
    } else if (isHTMLCommentNode(child)) {
      entries.push({ path, kind: "comment" })
    }
  })

  return entries
}

function resolveDOMPath(root: ParentNode, path: number[]): globalThis.Node | null {
  let current: globalThis.Node | null = root as globalThis.Node

  for (const index of path) {
    if (!current) return null
    current = current.childNodes[index] ?? null
  }

  return current
}

type DOMContext = "body" | "template" | "document"

function parseIntoDOM(html: string, context: DOMContext): ParentNode {
  switch (context) {
    case "body": {
      const container = document.createElement("div")
      document.body.appendChild(container)
      container.innerHTML = html

      return container
    }

    case "template": {
      const template = document.createElement("template")
      template.innerHTML = html

      return template.content
    }

    case "document": {
      const parsed = new DOMParser().parseFromString(html, "text/html")

      return parsed
    }
  }
}

interface AlignmentResult {
  total: number
  mismatches: Array<{ path: number[]; expected: string; actual: string }>
}

function checkAlignment(html: string, context: DOMContext): AlignmentResult {
  const result = Herb.parse(html)
  const entries = collectEntries(result.value as DocumentNode)
  const root = parseIntoDOM(html, context)
  const mismatches: AlignmentResult["mismatches"] = []

  for (const entry of entries) {
    const domNode = resolveDOMPath(root, entry.path)

    const describe = (node: globalThis.Node | null): string => {
      if (!node) return "null"
      if (node.nodeType === globalThis.Node.ELEMENT_NODE) return `<${(node as Element).tagName.toLowerCase()}>`
      if (node.nodeType === globalThis.Node.TEXT_NODE) return `text(${JSON.stringify(node.textContent)})`
      if (node.nodeType === globalThis.Node.COMMENT_NODE) return "comment"

      return `nodeType(${node.nodeType})`
    }

    let expected: string
    let matches: boolean

    switch (entry.kind) {
      case "element":
        expected = `<${entry.tagName}>`
        matches = domNode?.nodeType === globalThis.Node.ELEMENT_NODE &&
          (domNode as Element).tagName.toLowerCase() === entry.tagName
        break
      case "text":
        expected = `text(${JSON.stringify(entry.content)})`
        matches = domNode?.nodeType === globalThis.Node.TEXT_NODE
        break
      case "comment":
        expected = "comment"
        matches = domNode?.nodeType === globalThis.Node.COMMENT_NODE
        break
    }

    if (!matches) {
      mismatches.push({ path: entry.path, expected, actual: describe(domNode) })
    }
  }

  return { total: entries.length, mismatches }
}

function expectAligned(html: string, context: DOMContext = "body") {
  const { total, mismatches } = checkAlignment(html, context)
  expect(total).toBeGreaterThan(0)
  expect(mismatches).toEqual([])
}

function expectMisaligned(html: string, context: DOMContext = "body") {
  const { mismatches } = checkAlignment(html, context)
  expect(mismatches.length).toBeGreaterThan(0)
}

describe("AST path ↔ DOM childNodes alignment", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  describe("holds", () => {
    test("plain nested elements", () => {
      expectAligned(`<div><span>a</span><b>x</b></div>`)
    })

    test("whitespace text nodes between elements", () => {
      expectAligned(`<div>\n  <span>a</span>\n  <b>x</b>\n</div>`)
    })

    test("multiple document-level roots with surrounding text", () => {
      expectAligned(`text before <div>one</div> between <div>two</div> after`)
    })

    test("comments", () => {
      expectAligned(`<div><!-- note --><span>a</span><!-- another --></div>`)
    })

    test("deeply nested structure", () => {
      expectAligned(`<section><article><header><h1>Title</h1></header><p>Body <em>emphasis</em> tail</p></article></section>`)
    })

    test("entities occupy a single text node either side", () => {
      expectAligned(`<p>Fish &amp; Chips &lt;tag&gt;</p>`)
    })

    test("void elements", () => {
      expectAligned(`<div><img src="a.png"><br><input type="text"></div>`)
    })

    test("svg subtree", () => {
      expectAligned(`<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"></circle><rect width="2" height="2"></rect></svg>`)
    })

    test("table with explicit tbody", () => {
      expectAligned(`<table><tbody><tr><td>a</td><td>b</td></tr></tbody></table>`)
    })

    test("bare table fragment (<tr> without <table>) in template content", () => {
      expectAligned(`<tr><td>a</td><td>b</td></tr>`, "template")
    })

    test("head content in template context", () => {
      expectAligned(`<meta name="x" content="y"><title>t</title>`, "template")
    })
  })

  describe("breaks — marker-anchored fallback required", () => {
    test("table without tbody in body context (browser inserts tbody)", () => {
      expectMisaligned(`<table><tr><td>a</td></tr></table>`)
    })

    test("table without tbody gets implied tbody even in template content", () => {
      expectMisaligned(`<table><tr><td>a</td></tr></table>`, "template")
    })

    test("unclosed <p> before block element (browser auto-closes)", () => {
      expectMisaligned(`<p>before<div>inner</div>after</p>`)
    })

    test("<li> siblings with implied closes inside misnested list", () => {
      const { mismatches } = checkAlignment(`<ul><li>a<li>b</ul>`, "body")

      for (const mismatch of mismatches) {
        expect(mismatch.actual).not.toBe(mismatch.expected)
      }
    })
  })

  describe("invariants for the patch client", () => {
    test("misalignment resolves to null or a different node kind, never a plausible impostor of the same tag", () => {
      const cases = [
        `<table><tr><td>a</td></tr></table>`,
        `<p>before<div>inner</div>after</p>`,
      ]

      for (const html of cases) {
        const { mismatches } = checkAlignment(html, "body")

        for (const mismatch of mismatches) {
          expect(mismatch.actual).not.toBe(mismatch.expected)
        }
      }
    })
  })
})
