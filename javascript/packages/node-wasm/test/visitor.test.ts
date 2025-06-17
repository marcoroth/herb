import { describe, test, expect, beforeAll } from "vitest"
import { Herb, Visitor } from "../src"
import type { Node, HTMLTextNode } from "../src/index.js"

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
})
