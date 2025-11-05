import { describe, test, expect } from "vitest"
import {
  isLiteralNode,
  filterLiteralNodes,
  isERBContentNode,
  isERBOutputNode,
  isERBControlFlowNode,
  hasERBContent,
  hasERBOutput,
  filterERBContentNodes,
  getStaticStringFromNodes,
  getStaticContentFromNodes,
  hasStaticContent,
  isEffectivelyStatic,
  getValidatableStaticContent,
  getCombinedStringFromNodes,
  hasStaticAttributeName,
  hasDynamicAttributeName,
  getStaticAttributeName,
  getCombinedAttributeName,
  Location,
  HTMLAttributeNameNode
} from "../src"

import type { Node, LiteralNode, ERBContentNode } from "../src/nodes.js"

describe("ast-utils", () => {
  const createLiteralNode = (content: string): LiteralNode => ({
    type: "AST_LITERAL_NODE",
    content,
    location: Location.from(1, 1, 1, 1)
  })

  const createERBContentNode = (tagOpening: string, content: string = "", tagClosing: string = "%>"): ERBContentNode => ({
    type: "AST_ERB_CONTENT_NODE",
    tag_opening: { type: "AST_TOKEN", value: tagOpening, location: Location.from(1, 1, 1, 1) },
    content: content ? { type: "AST_TOKEN", value: content, location: Location.from(1, 1, 1, 1) } : undefined,
    tag_closing: { type: "AST_TOKEN", value: tagClosing, location: Location.from(1, 1, 1, 1) },
    location: Location.from(1, 1, 1, 1)
  })

  const createAttributeNameNode = (children: Node[]): HTMLAttributeNameNode => ({
    type: "AST_HTML_ATTRIBUTE_NAME_NODE",
    children,
    location: Location.from(1, 1, 1, 1)
  })

  describe("isLiteralNode", () => {
    test("returns true for literal nodes", () => {
      const node = createLiteralNode("test")
      expect(isLiteralNode(node)).toBe(true)
    })

    test("returns false for ERB content nodes", () => {
      const node = createERBContentNode("<%=", "test")
      expect(isLiteralNode(node)).toBe(false)
    })
  })

  describe("filterLiteralNodes", () => {
    test("filters only literal nodes from mixed array", () => {
      const literal1 = createLiteralNode("hello")
      const erb = createERBContentNode("<%=", "name")
      const literal2 = createLiteralNode(" world")
      const nodes = [literal1, erb, literal2]

      const result = filterLiteralNodes(nodes)

      expect(result).toEqual([literal1, literal2])
    })

    test("returns empty array when no literal nodes", () => {
      const nodes = [createERBContentNode("<%=", "test")]

      expect(filterLiteralNodes(nodes)).toEqual([])
    })
  })

  describe("isERBContentNode", () => {
    test("returns true for ERB content nodes", () => {
      const node = createERBContentNode("<%=", "test")

      expect(isERBContentNode(node)).toBe(true)
    })

    test("returns false for literal nodes", () => {
      const node = createLiteralNode("test")

      expect(isERBContentNode(node)).toBe(false)
    })
  })

  describe("isERBOutputNode", () => {
    test("returns true for <%= output nodes", () => {
      const node = createERBContentNode("<%=", "test")

      expect(isERBOutputNode(node)).toBe(true)
    })

    test("returns true for <%== escaped output nodes", () => {
      const node = createERBContentNode("<%==", "test")

      expect(isERBOutputNode(node)).toBe(true)
    })

    test("returns false for <% control nodes", () => {
      const node = createERBContentNode("<%", "if condition")

      expect(isERBOutputNode(node)).toBe(false)
    })

    test("returns false for literal nodes", () => {
      const node = createLiteralNode("test")

      expect(isERBOutputNode(node)).toBe(false)
    })
  })

  describe("isERBControlFlowNode", () => {
    test("returns true for <% control nodes", () => {
      const node = createERBContentNode("<%", "if condition")

      expect(isERBControlFlowNode(node)).toBe(false)
    })

    test("returns false for <%= output nodes", () => {
      const node = createERBContentNode("<%=", "test")

      expect(isERBControlFlowNode(node)).toBe(false)
    })

    test("returns false for <%== escaped output nodes", () => {
      const node = createERBContentNode("<%==", "test")

      expect(isERBControlFlowNode(node)).toBe(false)
    })

    test("returns false for literal nodes", () => {
      const node = createLiteralNode("test")

      expect(isERBControlFlowNode(node)).toBe(false)
    })
  })

  describe("hasERBContent", () => {
    test("returns true when array contains ERB nodes", () => {
      const nodes = [createLiteralNode("hello"), createERBContentNode("<%=", "name")]

      expect(hasERBContent(nodes)).toBe(true)
    })

    test("returns false when array contains only literals", () => {
      const nodes = [createLiteralNode("hello"), createLiteralNode(" world")]

      expect(hasERBContent(nodes)).toBe(false)
    })

    test("returns false for empty array", () => {

      expect(hasERBContent([])).toBe(false)
    })
  })

  describe("hasERBOutput", () => {
    test("returns true when array contains output ERB nodes", () => {
      const nodes = [createLiteralNode("hello"), createERBContentNode("<%=", "name")]

      expect(hasERBOutput(nodes)).toBe(true)
    })

    test("returns false when array contains only control ERB", () => {
      const nodes = [createLiteralNode("hello"), createERBContentNode("<%", "if condition")]

      expect(hasERBOutput(nodes)).toBe(false)
    })

    test("returns false when array contains only literals", () => {
      const nodes = [createLiteralNode("hello"), createLiteralNode(" world")]

      expect(hasERBOutput(nodes)).toBe(false)
    })
  })

  describe("filterERBContentNodes", () => {
    test("filters only ERB content nodes from mixed array", () => {
      const literal = createLiteralNode("hello")
      const erb1 = createERBContentNode("<%=", "name")
      const erb2 = createERBContentNode("<%", "if condition")
      const nodes = [literal, erb1, erb2]
      const result = filterERBContentNodes(nodes)

      expect(result).toEqual([erb1, erb2])
    })

    test("returns empty array when no ERB nodes", () => {
      const nodes = [createLiteralNode("test")]

      expect(filterERBContentNodes(nodes)).toEqual([])
    })
  })

  describe("getStaticStringFromNodes", () => {
    test("returns concatenated string for all literal nodes", () => {
      const nodes = [createLiteralNode("hello"), createLiteralNode(" world")]

      expect(getStaticStringFromNodes(nodes)).toBe("hello world")
    })

    test("returns null for mixed node types", () => {
      const nodes = [createLiteralNode("hello"), createERBContentNode("<%=", "name")]

      expect(getStaticStringFromNodes(nodes)).toBe(null)
    })

    test("returns empty string for empty array", () => {
      expect(getStaticStringFromNodes([])).toBe("")
    })
  })

  describe("getStaticContentFromNodes", () => {
    test("returns concatenated literal content from mixed nodes", () => {
      const nodes = [
        createLiteralNode("hello"),
        createERBContentNode("<%=", "name"),
        createLiteralNode(" world")
      ]

      expect(getStaticContentFromNodes(nodes)).toBe("hello world")
    })

    test("returns null when no literal nodes", () => {
      const nodes = [createERBContentNode("<%=", "test")]

      expect(getStaticContentFromNodes(nodes)).toBe(null)
    })

    test("returns empty string for empty array", () => {
      expect(getStaticContentFromNodes([])).toBe(null)
    })
  })

  describe("hasStaticContent", () => {
    test("returns true when array contains literal nodes", () => {
      const nodes = [createERBContentNode("<%=", "name"), createLiteralNode("hello")]

      expect(hasStaticContent(nodes)).toBe(true)
    })

    test("returns false when array contains only ERB nodes", () => {
      const nodes = [createERBContentNode("<%=", "test")]

      expect(hasStaticContent(nodes)).toBe(false)
    })
  })

  describe("isEffectivelyStatic", () => {
    test("returns true for only literal nodes", () => {
      const nodes = [createLiteralNode("hello"), createLiteralNode(" world")]

      expect(isEffectivelyStatic(nodes)).toBe(true)
    })

    test("returns true for literals and control ERB", () => {
      const nodes = [
        createLiteralNode("hello"),
        createERBContentNode("<%", "if condition"),
        createLiteralNode(" world")
      ]

      expect(isEffectivelyStatic(nodes)).toBe(true)
    })

    test("returns false when contains output ERB", () => {
      const nodes = [createLiteralNode("hello"), createERBContentNode("<%=", "name")]

      expect(isEffectivelyStatic(nodes)).toBe(false)
    })
  })

  describe("getValidatableStaticContent", () => {
    test("returns concatenated literal content when no output ERB", () => {
      const nodes = [
        createLiteralNode("hello"),
        createERBContentNode("<%", "if condition"),
        createLiteralNode(" world")
      ]

      expect(getValidatableStaticContent(nodes)).toBe("hello world")
    })

    test("returns null when contains output ERB", () => {
      const nodes = [createLiteralNode("hello"), createERBContentNode("<%=", "name")]

      expect(getValidatableStaticContent(nodes)).toBe(null)
    })

    test("returns empty string when no literal nodes but no output ERB", () => {
      const nodes = [createERBContentNode("<%", "if condition")]

      expect(getValidatableStaticContent(nodes)).toBe("")
    })
  })

  describe("getCombinedStringFromNodes", () => {
    test("combines literal and ERB content with tags", () => {
      const nodes = [
        createLiteralNode("hello"),
        createERBContentNode("<%=", "name"),
        createLiteralNode(" world")
      ]

      expect(getCombinedStringFromNodes(nodes)).toBe("hello<%=name%> world")
    })

    test("handles ERB without content", () => {
      const erbNode = createERBContentNode("<%", "")
      erbNode.content = undefined
      const nodes = [createLiteralNode("test"), erbNode]

      expect(getCombinedStringFromNodes(nodes)).toBe("test<%%>")
    })

    test("handles unknown node types", () => {
      const unknownNode: Node = {
        type: "UNKNOWN_NODE" as any,
        location: Location.from(1, 1, 1, 1)
      }

      const nodes = [createLiteralNode("test"), unknownNode]

      expect(getCombinedStringFromNodes(nodes)).toBe("test[UNKNOWN_NODE]")
    })
  })

  describe("hasStaticAttributeName", () => {
    test("returns true for attribute with only literal children", () => {
      const attributeNode = createAttributeNameNode([
        createLiteralNode("data"),
        createLiteralNode("-test")
      ])

      expect(hasStaticAttributeName(attributeNode)).toBe(true)
    })

    test("returns false for attribute with ERB children", () => {
      const attributeNode = createAttributeNameNode([
        createLiteralNode("data-"),
        createERBContentNode("<%=", "name")
      ])

      expect(hasStaticAttributeName(attributeNode)).toBe(false)
    })

    test("returns false for attribute without children", () => {
      const attributeNode = createAttributeNameNode([])
      attributeNode.children = undefined as any

      expect(hasStaticAttributeName(attributeNode)).toBe(false)
    })
  })

  describe("hasDynamicAttributeName", () => {
    test("returns true for attribute with ERB children", () => {
      const attributeNode = createAttributeNameNode([
        createLiteralNode("data-"),
        createERBContentNode("<%=", "name")
      ])

      expect(hasDynamicAttributeName(attributeNode)).toBe(true)
    })

    test("returns false for attribute with only literal children", () => {
      const attributeNode = createAttributeNameNode([
        createLiteralNode("data"),
        createLiteralNode("-test")
      ])

      expect(hasDynamicAttributeName(attributeNode)).toBe(false)
    })

    test("returns false for attribute without children", () => {
      const attributeNode = createAttributeNameNode([])
      attributeNode.children = undefined as any

      expect(hasDynamicAttributeName(attributeNode)).toBe(false)
    })
  })

  describe("getStaticAttributeName", () => {
    test("returns concatenated string for static attribute name", () => {
      const attributeNode = createAttributeNameNode([
        createLiteralNode("data"),
        createLiteralNode("-test")
      ])

      expect(getStaticAttributeName(attributeNode)).toBe("data-test")
    })

    test("returns null for dynamic attribute name", () => {
      const attributeNode = createAttributeNameNode([
        createLiteralNode("data-"),
        createERBContentNode("<%=", "name")
      ])

      expect(getStaticAttributeName(attributeNode)).toBe(null)
    })

    test("returns null for attribute without children", () => {
      const attributeNode = createAttributeNameNode([])
      attributeNode.children = undefined as any

      expect(getStaticAttributeName(attributeNode)).toBe(null)
    })
  })

  describe("getCombinedAttributeName", () => {
    test("returns combined string for mixed attribute name", () => {
      const attributeNode = createAttributeNameNode([
        createLiteralNode("data-"),
        createERBContentNode("<%=", "name"),
        createLiteralNode("-attr")
      ])

      expect(getCombinedAttributeName(attributeNode)).toBe("data-<%=name%>-attr")
    })

    test("returns static string for literal-only attribute name", () => {
      const attributeNode = createAttributeNameNode([
        createLiteralNode("data"),
        createLiteralNode("-test")
      ])

      expect(getCombinedAttributeName(attributeNode)).toBe("data-test")
    })

    test("returns empty string for attribute without children", () => {
      const attributeNode = createAttributeNameNode([])
      attributeNode.children = undefined as any

      expect(getCombinedAttributeName(attributeNode)).toBe("")
    })
  })
})
