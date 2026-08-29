import { describe, test, expect } from "vitest"

import {
  Visitor,
  DocumentNode,
  HTMLElementNode,
  HTMLTextNode,
  ERBContentNode,
  RubyParameterNode,
} from "../src/index.js"

import type { ChildNodeList, Node } from "../src/index.js"

import { Position } from "../src/position.js"
import { Location } from "../src/location.js"

class RecordingVisitor extends Visitor {
  visited: string[] = []
  lists: [string, string, string[], boolean, number][] = []

  visitChildNodes(node: Node): void {
    this.visited.push(node.constructor.name)
    super.visitChildNodes(node)
  }

  visitChildNodeList(list: ChildNodeList, parent: Node): void {
    this.lists.push([parent.constructor.name, list.name, list.kind, list.content, list.nodes.length])
  }
}

describe("Visitor", () => {
  test("traverses nodes", () => {
    const position = new Position(1, 0)
    const location = new Location(position, position)

    const text = HTMLTextNode.build({
      location,
      content: "Hello",
    })

    const erb = ERBContentNode.build({ location })

    const element = HTMLElementNode.build({
      location,
      body: [text, erb],
    })

    const doc = DocumentNode.build({
      location,
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

    expect(visitor.lists).toEqual([
      ["DocumentNode", "children", ["Node"], true, 1],
      ["HTMLElementNode", "body", ["Node"], true, 2],
    ])
  })

  test("childNodeFields exposes every single node field and marks continuations", () => {
    const position = new Position(1, 0)
    const location = new Location(position, position)

    const element = new HTMLElementNode({
      type: "AST_HTML_ELEMENT_NODE",
      location,
      errors: [],
      open_tag: null,
      tag_name: null,
      body: [],
      close_tag: null,
      is_void: false,
    })

    expect(element.childNodeFields().map(field => [field.name, field.continuation])).toEqual([
      ["open_tag", false],
      ["close_tag", false],
    ])
  })

  test("accept does not crash when visitor is missing a visit method", () => {
    const position = new Position(1, 0)
    const location = new Location(position, position)

    const node = RubyParameterNode.build({
      location,
      kind: "required",
      required: true,
    })

    const incompleteVisitor = new Visitor()
    delete (incompleteVisitor as any).visitRubyParameterNode

    expect(() => {
      node.accept(incompleteVisitor)
    }).not.toThrow()
  })

  test("accept calls the visitor method when it exists", () => {
    const position = new Position(1, 0)
    const location = new Location(position, position)

    const node = RubyParameterNode.build({
      location,
      kind: "required",
      required: true,
    })

    const visitor = new RecordingVisitor()
    node.accept(visitor)

    expect(visitor.visited).toContain("RubyParameterNode")
  })
})
