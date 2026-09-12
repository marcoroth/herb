import { describe, test, expect } from "vitest"
import { locate, locatable } from "../src/locate.js"
import { ParseResult } from "../src/parse-result.js"

import { Location } from "../src/location.js"
import { Position } from "../src/position.js"
import { Token } from "../src/token.js"
import { DocumentNode, HTMLElementNode, HTMLOpenTagNode, HTMLCloseTagNode, HTMLTextNode } from "../src/nodes.js"

import type { Node } from "../src/nodes.js"

// <div><span>hi</span></div>
function tree() {
  const text = HTMLTextNode.build({ content: "hi", location: Location.from(1, 11, 1, 13) })

  const spanOpen = HTMLOpenTagNode.build({
    tag_name: Token.from("TOKEN_HTML_TAG_NAME", "span"),
    location: Location.from(1, 5, 1, 11),
  })

  const spanClose = HTMLCloseTagNode.build({
    tag_name: Token.from("TOKEN_HTML_TAG_NAME", "span"),
    location: Location.from(1, 13, 1, 20),
  })

  const span = HTMLElementNode.build({
    tag_name: Token.from("TOKEN_HTML_TAG_NAME", "span"),
    open_tag: spanOpen,
    body: [text],
    close_tag: spanClose,
    location: Location.from(1, 5, 1, 20),
  })

  const divOpen = HTMLOpenTagNode.build({
    tag_name: Token.from("TOKEN_HTML_TAG_NAME", "div"),
    location: Location.from(1, 0, 1, 5),
  })

  const divClose = HTMLCloseTagNode.build({
    tag_name: Token.from("TOKEN_HTML_TAG_NAME", "div"),
    location: Location.from(1, 20, 1, 26),
  })

  const div = HTMLElementNode.build({
    tag_name: Token.from("TOKEN_HTML_TAG_NAME", "div"),
    open_tag: divOpen,
    body: [span],
    close_tag: divClose,
    location: Location.from(1, 0, 1, 26),
  })

  const document = DocumentNode.build({ children: [div], location: Location.from(1, 0, 1, 26) })

  return { document, div, divOpen, divClose, span, spanOpen, spanClose, text }
}

const types = (nodes: Node[]) => nodes.map((node) => node.constructor.name)

const at = (node: Node, column: number) => locate(node, Position.from(1, column))

describe("locate", () => {
  describe("what it finds", () => {
    test("the innermost node at a position", () => {
      const { document, text } = tree()

      expect(at(document, 12)!.node).toBe(text)
    })

    test("an open tag when the position is on the tag name", () => {
      const { document, spanOpen } = tree()

      expect(at(document, 7)!.node).toBe(spanOpen)
    })

    test("a close tag", () => {
      const { document, spanClose } = tree()

      expect(at(document, 15)!.node).toBe(spanClose)
    })
  })

  describe("ancestors", () => {
    test("read nearest first", () => {
      const { document } = tree()

      expect(types(at(document, 12)!.ancestors)).toEqual([
        "HTMLElementNode",
        "HTMLElementNode",
        "DocumentNode",
      ])
    })

    test("are empty when the node the walk started from is the answer", () => {
      const { text } = tree()

      expect(at(text, 12)!.ancestors).toEqual([])
      expect(at(text, 12)!.node).toBe(text)
    })

    test("place the position inside every one of them", () => {
      const { document } = tree()
      const position = Position.from(1, 12)

      expect(at(document, 12)!.ancestors.every((node) => node.location.contains(position))).toBe(true)
    })
  })

  describe("a position outside the source", () => {
    test("answers with nothing when it is past the end", () => {
      const { document } = tree()

      expect(at(document, 999)).toBeNull()
    })

    test("answers with nothing when it is on a line that does not exist", () => {
      const { document } = tree()

      expect(locate(document, Position.from(99, 0))).toBeNull()
    })

    test("answers with nothing when it is outside the node the walk started from", () => {
      const { span } = tree()

      expect(at(span, 2)).toBeNull()
    })
  })

  describe("where one node ends and the next begins", () => {
    test("a node's own start belongs to it", () => {
      const { document, divOpen } = tree()

      expect(at(document, 0)!.node).toBe(divOpen)
    })

    test("the character an inner node starts at belongs to the inner node", () => {
      const { document, spanOpen } = tree()

      expect(at(document, 5)!.node).toBe(spanOpen)
    })

    test("the character before it still belongs to the node that ends there", () => {
      const { document, divOpen } = tree()

      expect(at(document, 4)!.node).toBe(divOpen)
    })
  })

  describe("innermost", () => {
    test("answers with the node itself when it matches", () => {
      const { document, spanOpen } = tree()
      const result = at(document, 7)!

      expect(result.innermost((node) => node instanceof HTMLOpenTagNode)).toBe(spanOpen)
    })

    test("walks up to the nearest ancestor that matches", () => {
      const { document, span } = tree()
      const result = at(document, 12)!

      expect(result.innermost((node) => node instanceof HTMLElementNode)).toBe(span)
    })

    test("answers with nothing when no node matches", () => {
      const { document } = tree()
      const result = at(document, 12)!

      expect(result.innermost((node) => node instanceof DocumentNode && false)).toBeNull()
    })
  })

  describe("path", () => {
    test("reads outermost first and ends with the node that was found", () => {
      const { document, text } = tree()
      const result = at(document, 12)!

      expect(types(result.path)).toEqual([
        "DocumentNode",
        "HTMLElementNode",
        "HTMLElementNode",
        "HTMLTextNode",
      ])

      expect(result.path.at(-1)).toBe(text)
    })
  })

  describe("a node the parser synthesized", () => {
    test("is stepped over, because a zero location answers for nothing", () => {
      const node = HTMLTextNode.build({ content: "x" })

      expect(node.location.isEmpty()).toBe(true)
      expect(locate(node, Position.from(0, 0))).toBeNull()
    })

    test("does not swallow the position of the node next to it", () => {
      const { document, div, text } = tree()

      div.body.unshift(HTMLTextNode.build({ content: "", location: Location.from(1, 5, 1, 5) }))

      expect(at(document, 12)!.node).toBe(text)
    })
  })

  describe("a child positioned past the node that holds it", () => {
    function chain() {
      const tail = HTMLTextNode.build({ content: "C", location: Location.from(1, 20, 1, 21) })

      const held = HTMLElementNode.build({
        tag_name: Token.from("TOKEN_HTML_TAG_NAME", "b"),
        body: [tail],
        location: Location.from(1, 10, 1, 15),
      })

      const holder = HTMLElementNode.build({
        tag_name: Token.from("TOKEN_HTML_TAG_NAME", "i"),
        body: [held],
        location: Location.from(1, 0, 1, 10),
      })

      return { holder, held, tail }
    }

    test("is still reachable, because the walk goes by extent", () => {
      const { holder, tail } = chain()

      expect(locate(holder, Position.from(1, 20))!.node).toBe(tail)
    })

    test("keeps the whole walk in the path", () => {
      const { holder, held, tail } = chain()
      const found = locate(holder, Position.from(1, 20))!

      expect(found.path).toEqual([holder, held, tail])
    })

    test("leaves ancestors that do not cover the position for the caller to filter", () => {
      const { holder, held } = chain()
      const position = Position.from(1, 20)
      const found = locate(holder, position)!

      expect(found.ancestors).toEqual([held, holder])
      expect(found.ancestors.filter((node) => node.location.contains(position))).toEqual([])
    })

    test("answers with nothing when the position lands where no node actually sits", () => {
      const { holder } = chain()

      expect(locate(holder, Position.from(1, 17))).toBeNull()
    })

    test("answers with the nearest covering node when one of the ancestors does cover it", () => {
      const tail = HTMLTextNode.build({ content: "C", location: Location.from(1, 20, 1, 21) })

      const held = HTMLElementNode.build({
        tag_name: Token.from("TOKEN_HTML_TAG_NAME", "b"),
        body: [tail],
        location: Location.from(1, 10, 1, 15),
      })

      const holder = HTMLElementNode.build({
        tag_name: Token.from("TOKEN_HTML_TAG_NAME", "i"),
        body: [held],
        location: Location.from(1, 0, 1, 30),
      })

      expect(locate(holder, Position.from(1, 17))!.node).toBe(holder)
    })
  })

  describe("a parse result", () => {
    test("answers for the document it parsed", () => {
      const { document, text } = tree()
      const result = { value: document } as unknown as Parameters<typeof locate>[0]

      expect(locate(result, Position.from(1, 12))!.node).toBe(text)
    })
  })

  describe("locatable", () => {
    test("answers for a position the node covers", () => {
      const { document } = tree()

      expect(locatable(document, Position.from(1, 12))).toBe(true)
    })

    test("does not answer for a position past the end", () => {
      const { document } = tree()

      expect(locatable(document, Position.from(1, 999))).toBe(false)
    })

    test("answers for a position only something held further down covers", () => {
      const holder = HTMLElementNode.build({
        tag_name: Token.from("TOKEN_HTML_TAG_NAME", "i"),
        body: [HTMLTextNode.build({ content: "C", location: Location.from(1, 20, 1, 21) })],
        location: Location.from(1, 0, 1, 10),
      })

      expect(locatable(holder, Position.from(1, 20))).toBe(true)
    })
  })

  describe("a parse result answering for itself", () => {
    test("delegates to locate", () => {
      const { document, text } = tree()
      const result = { value: document, locate: undefined } as any

      result.locate = ParseResult.prototype.locate
      result.locatable = ParseResult.prototype.locatable

      expect(result.locate(Position.from(1, 12)).node).toBe(text)
      expect(result.locatable(Position.from(1, 12))).toBe(true)
      expect(result.locatable(Position.from(1, 999))).toBe(false)
    })
  })

  describe("a node answering for itself", () => {
    test("finds the most specific node at a position", () => {
      const { document, text } = tree()

      expect(document.locate(Position.from(1, 12))!.node).toBe(text)
    })

    test("answers the same way the free function does", () => {
      const { document } = tree()
      const position = Position.from(1, 12)

      expect(document.locate(position)!.node).toBe(locate(document, position)!.node)
    })

    test("works on a node reached through a walk", () => {
      const { document, text } = tree()
      const span = document.locate(Position.from(1, 12))!.ancestors[0]

      expect(span.locate(Position.from(1, 12))!.node).toBe(text)
    })

    test("says whether a position falls inside it at all", () => {
      const { document } = tree()

      expect(document.locatable(Position.from(1, 12))).toBe(true)
      expect(document.locatable(Position.from(1, 999))).toBe(false)
    })
  })
})
