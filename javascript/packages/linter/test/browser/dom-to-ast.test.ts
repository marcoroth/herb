import { describe, test, expect, afterEach } from "vitest"

import { domToAST, DOM_NODE, sourcePathOf } from "../../src/browser/dom-to-ast.js"

import { dom, element, resetDOM } from "./support/dom.js"

import type { WithDOMNode } from "../../src/browser/dom-to-ast.js"
import type { HTMLElementNode } from "@herb-tools/core"

afterEach(resetDOM)

const inspect = (root: Node) => "\n" + domToAST(root as any).treeInspect().split("\n").map((line) => line.trimEnd()).join("\n").trimEnd() + "\n"
const first = (root: Node) => domToAST(root as any).children[0] as HTMLElementNode

describe("domToAST", () => {
  test("builds an element, its open and close tag, and nothing it was not given", () => {
    expect(inspect(element`<div></div>`)).toMatchInlineSnapshot(`
      "
      @ DocumentNode (location: ∅)
      ├── errors: []
      └── children: (1 item)
          └── @ HTMLElementNode (location: ∅)
              ├── errors: []
              ├── open_tag:
              │   └── @ HTMLOpenTagNode (location: ∅)
              │       ├── errors: []
              │       ├── tag_opening: "<" (location: ∅)
              │       ├── tag_name: "div" (location: ∅)
              │       ├── tag_closing: ">" (location: ∅)
              │       ├── children: []
              │       └── is_void: false
              │
              ├── tag_name: "div" (location: ∅)
              ├── body: []
              ├── close_tag:
              │   └── @ HTMLCloseTagNode (location: ∅)
              │       ├── errors: []
              │       ├── tag_opening: "</" (location: ∅)
              │       ├── tag_name: "div" (location: ∅)
              │       ├── children: []
              │       └── tag_closing: ">" (location: ∅)
              │
              ├── is_void: false
              └── element_source: "DOM"
      "
    `)
  })

  test("lowercases the tag name the DOM reports in upper case", () => {
    expect(first(element`<div></div>`).tag_name?.value).toBe("div")
  })

  test("carries attributes across as name and value nodes", () => {
    expect(inspect(element`<div class="card"></div>`)).toMatchInlineSnapshot(`
      "
      @ DocumentNode (location: ∅)
      ├── errors: []
      └── children: (1 item)
          └── @ HTMLElementNode (location: ∅)
              ├── errors: []
              ├── open_tag:
              │   └── @ HTMLOpenTagNode (location: ∅)
              │       ├── errors: []
              │       ├── tag_opening: "<" (location: ∅)
              │       ├── tag_name: "div" (location: ∅)
              │       ├── tag_closing: ">" (location: ∅)
              │       ├── children: (1 item)
              │       │   └── @ HTMLAttributeNode (location: ∅)
              │       │       ├── errors: []
              │       │       ├── name:
              │       │       │   └── @ HTMLAttributeNameNode (location: ∅)
              │       │       │       ├── errors: []
              │       │       │       └── children: (1 item)
              │       │       │           └── @ LiteralNode (location: ∅)
              │       │       │               ├── errors: []
              │       │       │               └── content: "class"
              │       │       │
              │       │       │
              │       │       │
              │       │       ├── equals: "=" (location: ∅)
              │       │       └── value:
              │       │           └── @ HTMLAttributeValueNode (location: ∅)
              │       │               ├── errors: []
              │       │               ├── open_quote: """ (location: ∅)
              │       │               ├── children: (1 item)
              │       │               │   └── @ LiteralNode (location: ∅)
              │       │               │       ├── errors: []
              │       │               │       └── content: "card"
              │       │               │
              │       │               │
              │       │               ├── close_quote: """ (location: ∅)
              │       │               └── quoted: true
              │       │
              │       │
              │       │
              │       └── is_void: false
              │
              ├── tag_name: "div" (location: ∅)
              ├── body: []
              ├── close_tag:
              │   └── @ HTMLCloseTagNode (location: ∅)
              │       ├── errors: []
              │       ├── tag_opening: "</" (location: ∅)
              │       ├── tag_name: "div" (location: ∅)
              │       ├── children: []
              │       └── tag_closing: ">" (location: ∅)
              │
              ├── is_void: false
              └── element_source: "DOM"
      "
    `)
  })

  test("nests children", () => {
    expect(inspect(element`<div><span>hi</span></div>`)).toMatchInlineSnapshot(`
      "
      @ DocumentNode (location: ∅)
      ├── errors: []
      └── children: (1 item)
          └── @ HTMLElementNode (location: ∅)
              ├── errors: []
              ├── open_tag:
              │   └── @ HTMLOpenTagNode (location: ∅)
              │       ├── errors: []
              │       ├── tag_opening: "<" (location: ∅)
              │       ├── tag_name: "div" (location: ∅)
              │       ├── tag_closing: ">" (location: ∅)
              │       ├── children: []
              │       └── is_void: false
              │
              ├── tag_name: "div" (location: ∅)
              ├── body: (1 item)
              │   └── @ HTMLElementNode (location: ∅)
              │       ├── errors: []
              │       ├── open_tag:
              │       │   └── @ HTMLOpenTagNode (location: ∅)
              │       │       ├── errors: []
              │       │       ├── tag_opening: "<" (location: ∅)
              │       │       ├── tag_name: "span" (location: ∅)
              │       │       ├── tag_closing: ">" (location: ∅)
              │       │       ├── children: []
              │       │       └── is_void: false
              │       │
              │       ├── tag_name: "span" (location: ∅)
              │       ├── body: (1 item)
              │       │   └── @ HTMLTextNode (location: ∅)
              │       │       ├── errors: []
              │       │       └── content: "hi"
              │       │
              │       │
              │       ├── close_tag:
              │       │   └── @ HTMLCloseTagNode (location: ∅)
              │       │       ├── errors: []
              │       │       ├── tag_opening: "</" (location: ∅)
              │       │       ├── tag_name: "span" (location: ∅)
              │       │       ├── children: []
              │       │       └── tag_closing: ">" (location: ∅)
              │       │
              │       ├── is_void: false
              │       └── element_source: "DOM"
              │
              │
              ├── close_tag:
              │   └── @ HTMLCloseTagNode (location: ∅)
              │       ├── errors: []
              │       ├── tag_opening: "</" (location: ∅)
              │       ├── tag_name: "div" (location: ∅)
              │       ├── children: []
              │       └── tag_closing: ">" (location: ∅)
              │
              ├── is_void: false
              └── element_source: "DOM"
      "
    `)
  })

  test("keeps comments", () => {
    expect(inspect(element`<div><!-- note --></div>`)).toMatchInlineSnapshot(`
      "
      @ DocumentNode (location: ∅)
      ├── errors: []
      └── children: (1 item)
          └── @ HTMLElementNode (location: ∅)
              ├── errors: []
              ├── open_tag:
              │   └── @ HTMLOpenTagNode (location: ∅)
              │       ├── errors: []
              │       ├── tag_opening: "<" (location: ∅)
              │       ├── tag_name: "div" (location: ∅)
              │       ├── tag_closing: ">" (location: ∅)
              │       ├── children: []
              │       └── is_void: false
              │
              ├── tag_name: "div" (location: ∅)
              ├── body: (1 item)
              │   └── @ HTMLCommentNode (location: ∅)
              │       ├── errors: []
              │       ├── comment_start: "<!--" (location: ∅)
              │       ├── children: (1 item)
              │       │   └── @ LiteralNode (location: ∅)
              │       │       ├── errors: []
              │       │       └── content: " note "
              │       │
              │       │
              │       └── comment_end: "-->" (location: ∅)
              │
              │
              ├── close_tag:
              │   └── @ HTMLCloseTagNode (location: ∅)
              │       ├── errors: []
              │       ├── tag_opening: "</" (location: ∅)
              │       ├── tag_name: "div" (location: ∅)
              │       ├── children: []
              │       └── tag_closing: ">" (location: ∅)
              │
              ├── is_void: false
              └── element_source: "DOM"
      "
    `)
  })

  test("gives a void element no closing tag and no body", () => {
    expect(inspect(element`<img src="a.png">`)).toMatchInlineSnapshot(`
      "
      @ DocumentNode (location: ∅)
      ├── errors: []
      └── children: (1 item)
          └── @ HTMLElementNode (location: ∅)
              ├── errors: []
              ├── open_tag:
              │   └── @ HTMLOpenTagNode (location: ∅)
              │       ├── errors: []
              │       ├── tag_opening: "<" (location: ∅)
              │       ├── tag_name: "img" (location: ∅)
              │       ├── tag_closing: ">" (location: ∅)
              │       ├── children: (1 item)
              │       │   └── @ HTMLAttributeNode (location: ∅)
              │       │       ├── errors: []
              │       │       ├── name:
              │       │       │   └── @ HTMLAttributeNameNode (location: ∅)
              │       │       │       ├── errors: []
              │       │       │       └── children: (1 item)
              │       │       │           └── @ LiteralNode (location: ∅)
              │       │       │               ├── errors: []
              │       │       │               └── content: "src"
              │       │       │
              │       │       │
              │       │       │
              │       │       ├── equals: "=" (location: ∅)
              │       │       └── value:
              │       │           └── @ HTMLAttributeValueNode (location: ∅)
              │       │               ├── errors: []
              │       │               ├── open_quote: """ (location: ∅)
              │       │               ├── children: (1 item)
              │       │               │   └── @ LiteralNode (location: ∅)
              │       │               │       ├── errors: []
              │       │               │       └── content: "a.png"
              │       │               │
              │       │               │
              │       │               ├── close_quote: """ (location: ∅)
              │       │               └── quoted: true
              │       │
              │       │
              │       │
              │       └── is_void: true
              │
              ├── tag_name: "img" (location: ∅)
              ├── body: []
              ├── close_tag: ∅
              ├── is_void: true
              └── element_source: "DOM"
      "
    `)
  })

  test("drops a node kind it has no place for", () => {
    expect(inspect(element`<div><?php ?></div>`)).toMatchInlineSnapshot(`
      "
      @ DocumentNode (location: ∅)
      ├── errors: []
      └── children: (1 item)
          └── @ HTMLElementNode (location: ∅)
              ├── errors: []
              ├── open_tag:
              │   └── @ HTMLOpenTagNode (location: ∅)
              │       ├── errors: []
              │       ├── tag_opening: "<" (location: ∅)
              │       ├── tag_name: "div" (location: ∅)
              │       ├── tag_closing: ">" (location: ∅)
              │       ├── children: []
              │       └── is_void: false
              │
              ├── tag_name: "div" (location: ∅)
              ├── body: []
              ├── close_tag:
              │   └── @ HTMLCloseTagNode (location: ∅)
              │       ├── errors: []
              │       ├── tag_opening: "</" (location: ∅)
              │       ├── tag_name: "div" (location: ∅)
              │       ├── children: []
              │       └── tag_closing: ">" (location: ∅)
              │
              ├── is_void: false
              └── element_source: "DOM"
      "
    `)
  })

  test("unwraps a document or fragment down to its children", () => {
    const fragment = document.createDocumentFragment()

    fragment.append(document.createElement("main"))

    expect(inspect(fragment)).toMatchInlineSnapshot(`
      "
      @ DocumentNode (location: ∅)
      ├── errors: []
      └── children: (1 item)
          └── @ HTMLElementNode (location: ∅)
              ├── errors: []
              ├── open_tag:
              │   └── @ HTMLOpenTagNode (location: ∅)
              │       ├── errors: []
              │       ├── tag_opening: "<" (location: ∅)
              │       ├── tag_name: "main" (location: ∅)
              │       ├── tag_closing: ">" (location: ∅)
              │       ├── children: []
              │       └── is_void: false
              │
              ├── tag_name: "main" (location: ∅)
              ├── body: []
              ├── close_tag:
              │   └── @ HTMLCloseTagNode (location: ∅)
              │       ├── errors: []
              │       ├── tag_opening: "</" (location: ∅)
              │       ├── tag_name: "main" (location: ∅)
              │       ├── children: []
              │       └── tag_closing: ">" (location: ∅)
              │
              ├── is_void: false
              └── element_source: "DOM"
      "
    `)
  })

  describe("the live element", () => {
    test("is carried on the element node and its open tag", () => {
      const source = element`<div></div>`
      const node = first(source)

      expect((node as HTMLElementNode & WithDOMNode)[DOM_NODE]).toBe(source)
      expect((node.open_tag! as any)[DOM_NODE]).toBe(source)
    })
  })

  describe("where an element was written", () => {
    const found = (root: Node, selector: string) => {
      const element = (root as any).querySelector(selector)

      const walk = (node: any): any => {
        if (!node) return null
        if (node[DOM_NODE] === element) return node

        for (const child of node.childNodes()) {
          const hit = walk(child)

          if (hit) return hit
        }

        return null
      }

      return walk(domToAST(root as any))
    }

    const startOf = (node: any) => [node.location.start.line, node.location.start.column]

    test("a stamp names the line and column it was written at", () => {
      const node = found(dom(`<div data-herb-source="app/views/posts/_card.html.erb:8:3"><img id="a" src="/a.png"></div>`), "#a")

      expect(startOf(node)).toEqual([8, 2])
      expect(sourcePathOf(node)?.path).toBe("app/views/posts/_card.html.erb")
    })

    test("a region marker names the file, and answers with the top of it", () => {
      const node = found(dom(`<!--herb-region:app/views/posts/index.html.erb:c8082c87:0--><img id="b" src="/b.png"><!--/herb-region:app/views/posts/index.html.erb-->`), "#b")

      expect(startOf(node)).toEqual([1, 0])
      expect(sourcePathOf(node)?.path).toBe("app/views/posts/index.html.erb")
    })

    test("a stamp inside a region wins over the region", () => {
      const node = found(dom(`<!--herb-region:app/views/posts/index.html.erb:c8082c87:0--><img id="c" data-herb-source="app/views/posts/_card.html.erb:4:1" src="/c.png"><!--/herb-region:app/views/posts/index.html.erb-->`), "#c")

      expect(startOf(node)).toEqual([4, 0])
      expect(sourcePathOf(node)?.path).toBe("app/views/posts/_card.html.erb")
    })

    test("a region closes back to the one around it", () => {
      const root = dom(`<!--herb-region:outer.html.erb:c8082c87:0--><!--herb-region:inner.html.erb:c8082c87:0--><img id="d" src="/d.png"><!--/herb-region:inner.html.erb--><img id="e" src="/e.png"><!--/herb-region:outer.html.erb-->`)

      expect(sourcePathOf(found(root, "#d"))?.path).toBe("inner.html.erb")
      expect(sourcePathOf(found(root, "#e"))?.path).toBe("outer.html.erb")
    })

    test("a marker missing the version and occurrence names no region", () => {
      const node = found(dom(`<!--herb-region:app/views/posts/index.html.erb--><img id="g" src="/g.png">`), "#g")

      expect(sourcePathOf(node)).toBeNull()
    })

    test("a file with a colon in it still reads as the file", () => {
      const node = found(dom(`<!--herb-region:app/views/a:b.html.erb:c8082c87:0--><img id="h" src="/h.png">`), "#h")

      expect(sourcePathOf(node)?.path).toBe("app/views/a:b.html.erb")
    })

    test("neither a stamp nor a region leaves it unplaced", () => {
      const node = found(dom(`<img id="f" src="/f.png">`), "#f")

      expect(node.location).toBeNull()
      expect(sourcePathOf(node)).toBeNull()
    })
  })
})
