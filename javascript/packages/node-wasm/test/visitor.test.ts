import { describe, test, expect, beforeAll } from "vitest"
import { Herb, Visitor } from "../src"
import type { ChildNodeList, Node, HTMLTextNode } from "../src/index.js"

class RecordingVisitor extends Visitor {
  visited: string[] = []

  visitChildNodes(node: Node): void {
    this.visited.push(node.constructor.name)
    super.visitChildNodes(node)
  }
}

class TextNodeVisitor extends Visitor {
  textNodes: string[] = []

  visitHTMLTextNode(node: HTMLTextNode) {
    this.textNodes.push(node.content)
  }
}

class ChildNodeListVisitor extends Visitor {
  lists: [string, string, string[], boolean, number][] = []

  visitChildNodeList(list: ChildNodeList, parent: Node): void {
    this.lists.push([parent.constructor.name, list.name, list.kind, list.content, list.nodes.length])
  }
}

describe("Visitor", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("traverses nodes", () => {
    const visitor = new RecordingVisitor()

    const result = Herb.parse("<p>Hello</p>");
    result.visit(visitor)

    expect(visitor.visited).toEqual([
      "DocumentNode",
      "HTMLElementNode",
      "HTMLOpenTagNode",
      "HTMLTextNode",
      "HTMLCloseTagNode",
    ])
  })

  test("text content visitor", () => {
    const visitor = new TextNodeVisitor()

    const result = Herb.parse("<p>Hello</p>");
    result.visit(visitor)

    expect(visitor.textNodes).toEqual([
      "Hello"
    ])
  })

  test("visits each child node list of every node", () => {
    const visitor = new ChildNodeListVisitor()

    const result = Herb.parse("<div><% if true %>a<% else %>b<% end %></div>")
    result.visit(visitor)

    expect(visitor.lists).toEqual([
      ["DocumentNode", "children", ["Node"], true, 1],
      ["HTMLElementNode", "body", ["Node"], true, 1],
      ["HTMLOpenTagNode", "children", ["Node"], true, 0],
      ["ERBIfNode", "statements", ["Node"], true, 1],
      ["ERBElseNode", "statements", ["Node"], true, 1],
      ["HTMLCloseTagNode", "children", ["WhitespaceNode"], true, 0],
    ])
  })
})
