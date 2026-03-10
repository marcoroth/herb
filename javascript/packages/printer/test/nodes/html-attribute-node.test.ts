import { describe, test, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { HTMLAttributeNode, HTMLAttributeNameNode, HTMLAttributeValueNode } from "@herb-tools/core"

import { expectNodeToPrint, expectPrintRoundTrip, location, createToken, createLiteralNode } from "../helpers/printer-test-helpers.js"

const name = HTMLAttributeNameNode.from({
  type: "AST_HTML_ATTRIBUTE_NAME_NODE",
  location,
  errors: [],
  children: [
    createLiteralNode("id")
  ]
})

const value = HTMLAttributeValueNode.from({
  type: "AST_HTML_ATTRIBUTE_VALUE_NODE",
  location,
  errors: [],
  open_quote: createToken("TOKEN_QUOTE", `"`),
  close_quote: createToken("TOKEN_QUOTE", `"`),
  children: [
    createLiteralNode("value")
  ],
  quoted: true
})

describe("HTMLAttributeNode Printing", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("can print from node", () => {
    const node = HTMLAttributeNode.from({
      type: "AST_HTML_ATTRIBUTE_NODE",
      location,
      errors: [],
      name,
      equals: createToken("TOKEN_EQUALS", "="),
      value
    })

    expectNodeToPrint(node, `id="value"`)
  })

  test("can print from source", () => {
    expectPrintRoundTrip(`<div id="id"></div>`)
    expectPrintRoundTrip(`<div id="<%= dom_id(post) %>"></div>`)
    expectPrintRoundTrip(`<div id="<%= dom_id(post) %>" class="classes"></div>`)
  })

  test("preserve whitespace", () => {
    expectPrintRoundTrip(`<div id="<%= dom_id(post) %>"           class="classes"></div>`)
  })
})
