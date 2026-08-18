import { describe, it, expect, beforeAll } from "vitest"
import { loadPrism } from "@ruby/prism"

import { PrismVisitor } from "../src/prism/index.js"

import type { PrismNodes, PrismParseResult } from "../src/prism/index.js"

let parse: (source: string) => PrismParseResult

class CollectingVisitor extends PrismVisitor {
  public names: string[] = []

  visitInstanceVariableReadNode(node: PrismNodes.InstanceVariableReadNode): void {
    this.names.push(node.name)
  }

  visitInstanceVariableTargetNode(node: PrismNodes.InstanceVariableTargetNode): void {
    this.names.push(node.name)
  }

  visitInstanceVariableWriteNode(node: PrismNodes.InstanceVariableWriteNode): void {
    this.names.push(node.name)

    super.visitInstanceVariableWriteNode(node)
  }
}

const collect = (source: string): string[] => {
  const visitor = new CollectingVisitor()

  visitor.visit(parse(source).value)

  return visitor.names
}

describe("PrismVisitor", () => {
  beforeAll(async () => {
    parse = await loadPrism()
  })

  it("visits nodes nested in plain statements", () => {
    expect(collect("if a\n  @foo\nend")).toEqual(["@foo"])
  })

  describe("array-valued children dropped by @ruby/prism's compactChildNodes()", () => {
    it("visits the conditions and bodies of a case/when", () => {
      expect(collect("case a\nwhen 1\n  @foo\nend")).toEqual(["@foo"])
    })

    it("visits the conditions and bodies of a case/in", () => {
      expect(collect("case [a, b]\nin [1, true]\n  @foo\nend")).toEqual(["@foo"])
    })

    it("visits the targets of a multiple assignment", () => {
      expect(collect("@foo, @bar = 1, 2")).toEqual(["@foo", "@bar"])
    })

    it("visits the exceptions of a rescue clause", () => {
      expect(collect("begin\n  call\nrescue StandardError\n  @foo\nend")).toEqual(["@foo"])
    })

    it("visits the parameters of a method definition", () => {
      expect(collect("def call(a = @foo)\nend")).toEqual(["@foo"])
    })

    it("visits the elements of an array pattern", () => {
      expect(collect("case a\nin [Integer => @foo]\n  nil\nend")).toEqual(["@foo"])
    })
  })
})
