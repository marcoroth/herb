import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"

import type { ERBContentNode } from "@herb-tools/core"

describe("prismNode", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  function erbContentNode(source: string): ERBContentNode {
    const result = Herb.parse(source, { prism_nodes: true })

    return result.value.children[0] as ERBContentNode
  }

  test("returns the same Prism node on every read", () => {
    const node = erbContentNode("<%= user.name %>")

    expect(node.prismNode).not.toBeNull()
    expect(node.prismNode).toBe(node.prismNode)
  })

  test("returns a different Prism node for each ERB node", () => {
    const result = Herb.parse("<%= user.name %><%= user.email %>", { prism_nodes: true })
    const [first, second] = result.value.children as ERBContentNode[]

    expect(first.prismNode).not.toBe(second.prismNode)
    expect(first.prismNode.name).toBe("name")
    expect(second.prismNode.name).toBe("email")
  })

  test("deserializes again after the source changes", () => {
    const node = erbContentNode("<%= user.name %>")
    const before = node.prismNode

    node.setSource("<%= user.name %>\n")

    expect(node.prismNode).not.toBe(before)
    expect(node.prismNode.name).toBe("name")
  })

  test("returns null without a serialized Prism node", () => {
    const node = Herb.parse("<%= user.name %>").value.children[0] as ERBContentNode

    expect(node.prismNode).toBeNull()
  })
})
