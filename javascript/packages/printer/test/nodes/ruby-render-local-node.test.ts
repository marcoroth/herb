import { describe, test, expect, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { RubyRenderLocalNode, RubyLiteralNode, isERBRenderNode, isRubyRenderLocalNode } from "@herb-tools/core"

import { expectNodeToPrint, createLocation, createToken } from "../helpers/printer-test-helpers.js"

describe("RubyRenderLocalNode", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("can create from serialized data", () => {
    const node = RubyRenderLocalNode.from({
      type: "AST_RUBY_RENDER_LOCAL_NODE",
      location: createLocation(),
      errors: [],
      name: createToken("TOKEN_IDENTIFIER", "title"),
      value: {
        type: "AST_RUBY_LITERAL_NODE",
        location: createLocation(),
        errors: [],
        content: "@title"
      }
    })

    expect(node).toBeInstanceOf(RubyRenderLocalNode)
    expect(node.name?.value).toBe("title")
    expect(node.value).toBeInstanceOf(RubyLiteralNode)
    expect(node.value?.content).toBe("@title")
  })

  test("prints nothing (metadata node)", () => {
    const node = RubyRenderLocalNode.from({
      type: "AST_RUBY_RENDER_LOCAL_NODE",
      location: createLocation(),
      errors: [],
      name: createToken("TOKEN_IDENTIFIER", "title"),
      value: {
        type: "AST_RUBY_LITERAL_NODE",
        location: createLocation(),
        errors: [],
        content: "@title"
      }
    })

    expectNodeToPrint(node, "")
  })

  test("is a child of ERBRenderNode when locals are present", () => {
    const result = Herb.parse(`<%= render partial: "card", locals: { title: @title } %>`, { render_nodes: true })
    const renderNode = result.value.children[0]

    expect(isERBRenderNode(renderNode)).toBe(true)

    if (isERBRenderNode(renderNode)) {
      expect(renderNode.locals).toHaveLength(1)
      expect(isRubyRenderLocalNode(renderNode.locals[0])).toBe(true)

      const local = renderNode.locals[0]
      expect(local.name?.value).toBe("title")
      expect(local.value?.content).toBe("@title")
    }
  })

  test("multiple locals are extracted", () => {
    const result = Herb.parse(`<%= render "card", title: @title, body: "Hello" %>`, { render_nodes: true })
    const renderNode = result.value.children[0]

    if (isERBRenderNode(renderNode)) {
      expect(renderNode.locals).toHaveLength(2)

      const first = renderNode.locals[0]
      expect(first.name?.value).toBe("title")
      expect(first.value?.content).toBe("@title")

      const second = renderNode.locals[1]
      expect(second.name?.value).toBe("body")
    }
  })

  test("no locals when none provided", () => {
    const result = Herb.parse(`<%= render "card" %>`, { render_nodes: true })
    const renderNode = result.value.children[0]

    if (isERBRenderNode(renderNode)) {
      expect(renderNode.locals).toHaveLength(0)
    }
  })
})
