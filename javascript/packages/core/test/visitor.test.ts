import { describe, test, expect } from "vitest"

import {
  Visitor,
  DocumentNode,
  HTMLElementNode,
  HTMLTextNode,
  ERBContentNode,
} from "../src/index.js"

import type { Node } from "../src/index.js"

import { Position } from "../src/position.js"
import { Location } from "../src/location.js"

class RecordingVisitor extends Visitor {
  visited: string[] = []

  visitChildNodes(node: Node): void {
    this.visited.push(node.constructor.name)
    super.visitChildNodes(node)
  }
}

describe("Visitor", () => {
  test("traverses nodes", () => {
    const position = new Position(1, 0)
    const location = new Location(position, position)

    const text = new HTMLTextNode({
      type: "AST_HTML_TEXT_NODE",
      location,
      errors: [],
      content: "Hello",
    })

    const erb = new ERBContentNode({
      type: "AST_ERB_CONTENT_NODE",
      location,
      errors: [],
      tag_opening: null,
      content: null,
      tag_closing: null,
      parsed: false,
      valid: false,
    })

    const element = new HTMLElementNode({
      type: "AST_HTML_ELEMENT_NODE",
      location,
      errors: [],
      open_tag: null,
      tag_name: null,
      body: [text, erb],
      close_tag: null,
      is_void: false,
    })

    const doc = new DocumentNode({
      type: "AST_DOCUMENT_NODE",
      location,
      errors: [],
      children: [element],
    })

    const visitor = new RecordingVisitor()
    visitor.visit(doc)

    expect(visitor.visited).toEqual([
      "DocumentNode",
      "HTMLElementNode",
      "HTMLTextNode",
      "ERBContentNode",
    ])
  })
})
