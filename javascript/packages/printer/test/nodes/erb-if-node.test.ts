import dedent from "dedent"
import { describe, test, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { ERBIfNode, ERBElseNode } from "@herb-tools/core"

import { expectNodeToPrint, expectPrintRoundTrip, location, end_node, createToken, createTextNode } from "../helpers/printer-test-helpers.js"

describe("ERBIfNode Printing", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("can print from node", () => {
    const node = ERBIfNode.from({
      type: "AST_ERB_IF_NODE",
      location,
      errors: [],
      tag_opening: createToken("TOKEN_ERB_START", "<%"),
      content: createToken("TOKEN_ERB_CONTENT", " if condition? "),
      tag_closing: createToken("TOKEN_ERB_END", "%>"),
      statements: [
        createTextNode("\n  true\n")
      ],
      subsequent: null,
      end_node
    })

    expectNodeToPrint(node, dedent`
      <% if condition? %>
        true
      <% end %>
    `)
  })

  test("can print from instantiated node with subsequent", () => {
    const else_node = ERBElseNode.from({
      type: "AST_ERB_ELSE_NODE",
      location,
      errors: [],
      tag_opening: createToken("TOKEN_ERB_START", "<%"),
      content: createToken("TOKEN_ERB_CONTENT", " else "),
      tag_closing: createToken("TOKEN_ERB_END", "%>"),
      statements: [
        createTextNode("\n  else\n")
      ]
    })

    const subsequent = ERBIfNode.from({
      type: "AST_ERB_IF_NODE",
      location,
      errors: [],
      tag_opening: createToken("TOKEN_ERB_START", "<%"),
      content: createToken("TOKEN_ERB_CONTENT", " elsif another_condition? "),
      tag_closing: createToken("TOKEN_ERB_END", "%>"),
      statements: [
        createTextNode("\n  elsif\n")
      ],
      subsequent: else_node,
      end_node: null
    })


    const node = ERBIfNode.from({
      type: "AST_ERB_IF_NODE",
      location,
      errors: [],
      tag_opening: createToken("TOKEN_ERB_START", "<%"),
      content: createToken("TOKEN_ERB_CONTENT", " if condition? "),
      tag_closing: createToken("TOKEN_ERB_END", "%>"),
      statements: [
        createTextNode("\n  if\n")
      ],
      subsequent,
      end_node
    })

    expectNodeToPrint(node, dedent`
      <% if condition? %>
        if
      <% elsif another_condition? %>
        elsif
      <% else %>
        else
      <% end %>
    `)
  })

  test("can print from source", () => {
    expectPrintRoundTrip(`<% if true %>true<% end %>`)

    expectPrintRoundTrip(dedent`
      <% if true %>
        true
      <% end %>
    `)
  })

  test("can print from invalid source", () => {
    expectPrintRoundTrip(`<% if true %>true`, false)

    expectPrintRoundTrip(dedent`
      <% if true %>
        true
    `, false)
  })
})
