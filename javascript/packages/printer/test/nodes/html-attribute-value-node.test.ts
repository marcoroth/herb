import { describe, test, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { HTMLAttributeValueNode } from "@herb-tools/core"

import { expectNodeToPrint, createERBContentNode, location, singleQuote, doubleQuote, createLiteralNode } from "../helpers/printer-test-helpers.js"

describe("HTMLAttributeValueNode Printing", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("can print double quoted node", () => {
    const node = HTMLAttributeValueNode.from({
      type: "AST_HTML_ATTRIBUTE_VALUE_NODE",
      location,
      errors: [],
      open_quote: doubleQuote,
      close_quote: doubleQuote,
      children: [
        createLiteralNode("value")
      ],
      quoted: true
    })

    expectNodeToPrint(node, `"value"`)
  })

  test("can print single quoted node", () => {
    const node = HTMLAttributeValueNode.from({
      type: "AST_HTML_ATTRIBUTE_VALUE_NODE",
      location,
      errors: [],
      open_quote: singleQuote,
      close_quote: singleQuote,
      children: [createLiteralNode("value")],
      quoted: true
    })

    expectNodeToPrint(node, `'value'`)
  })

  test("can print unquoted node", () => {
    const node = HTMLAttributeValueNode.from({
      type: "AST_HTML_ATTRIBUTE_VALUE_NODE",
      location,
      errors: [],
      open_quote: null,
      close_quote: null,
      children: [createLiteralNode("value")],
      quoted: false
    })

    expectNodeToPrint(node, `value`)
  })

  test("can print node with multiple children", () => {
    const node = HTMLAttributeValueNode.from({
      type: "AST_HTML_ATTRIBUTE_VALUE_NODE",
      location,
      errors: [],
      open_quote: doubleQuote,
      close_quote: doubleQuote,
      children: [
        createLiteralNode("bg-black"),
        createLiteralNode(" "),
        createLiteralNode("text-white"),
      ],
      quoted: true
    })

    expectNodeToPrint(node, `"bg-black text-white"`)
  })

  test("can print node with multiple children and ERBContentNode", () => {
    const node = HTMLAttributeValueNode.from({
      type: "AST_HTML_ATTRIBUTE_VALUE_NODE",
      location,
      errors: [],
      open_quote: doubleQuote,
      close_quote: doubleQuote,
      children: [
        createLiteralNode("bg-black"),
        createLiteralNode(" "),
        createLiteralNode("text-white"),
        createLiteralNode(" "),
        createERBContentNode(" classes ", "<%=")
      ],
      quoted: true
    })

    expectNodeToPrint(node, `"bg-black text-white <%= classes %>"`)
  })
})
