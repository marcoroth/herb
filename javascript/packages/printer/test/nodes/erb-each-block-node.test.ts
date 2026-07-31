import dedent from "dedent"
import { describe, test, expect, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { ERBEachBlockNode } from "@herb-tools/core"

import {
  expectNodeToPrint,
  expectPrintRoundTrip,
  location,
  createToken,
  createTextNode,
  end_node
} from "../helpers/printer-test-helpers.js"

const eachNodes = { each_nodes: true }

describe("ERBEachBlockNode Printing", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("can print from node", () => {
    const node = ERBEachBlockNode.from({
      type: "AST_ERB_EACH_BLOCK_NODE",
      location,
      errors: [],
      tag_opening: createToken("TOKEN_ERB_START", "<%"),
      content: createToken("TOKEN_ERB_CONTENT", " users.each do |user| "),
      tag_closing: createToken("TOKEN_ERB_END", "%>"),
      receiver: createToken("TOKEN_ERB_CONTENT", "users"),
      call_operator: createToken("TOKEN_IDENTIFIER", "."),
      message: createToken("TOKEN_IDENTIFIER", "each"),
      block_opening: createToken("TOKEN_IDENTIFIER", "do"),
      body: [createTextNode("Content")],
      block_arguments: [],
      rescue_clause: null,
      else_clause: null,
      ensure_clause: null,
      end_node
    })

    expectNodeToPrint(node, "<% users.each do |user| %>Content<% end %>")
  })

  test("is only produced when each_nodes is enabled", () => {
    const source = `<% users.each do |user| %><%= user %><% end %>`

    const withoutOption = Herb.parse(source, { track_whitespace: true }).value.children[0]
    const withOption = Herb.parse(source, { track_whitespace: true, ...eachNodes }).value.children[0]

    expect(withoutOption.type).toBe("AST_ERB_BLOCK_NODE")
    expect(withOption.type).toBe("AST_ERB_EACH_BLOCK_NODE")
  })

  test("exposes the receiver, call operator, message and block opening", () => {
    const source = `<% @users.sort.each do |user| %><%= user %><% end %>`
    const node = Herb.parse(source, { track_whitespace: true, ...eachNodes }).value.children[0] as ERBEachBlockNode

    expect(node.receiver?.value).toBe("@users.sort")
    expect(node.call_operator?.value).toBe(".")
    expect(node.message?.value).toBe("each")
    expect(node.block_opening?.value).toBe("do")
    expect(node.block_arguments.map(argument => argument.name?.value)).toEqual(["user"])
  })

  test("can print from source", () => {
    expectPrintRoundTrip(`<% users.each do |user| %>Content<% end %>`, true, eachNodes)
  })

  test("can print each block without block parameters", () => {
    expectPrintRoundTrip(`<% users.each do %>Content<% end %>`, true, eachNodes)
  })

  test("can print each block with multiple block parameters", () => {
    expectPrintRoundTrip(`<% pairs.each do |key, value| %><%= key %><%= value %><% end %>`, true, eachNodes)
  })

  test("can print each block with a brace block", () => {
    expectPrintRoundTrip(`<% users.each { |user| %><%= user %><% } %>`, true, eachNodes)
  })

  test("can print each block as an output tag", () => {
    expectPrintRoundTrip(`<%= users.each do |user| %><%= user %><% end %>`, true, eachNodes)
  })

  test("can print each block with safe navigation", () => {
    expectPrintRoundTrip(`<% users&.each do |user| %><%= user %><% end %>`, true, eachNodes)
  })

  test("can print each block with rescue from source", () => {
    expectPrintRoundTrip(`<% users.each do |user| %>Content<% rescue %>Error<% end %>`, true, eachNodes)
  })

  test("can print each block with rescue, else, and ensure from source", () => {
    expectPrintRoundTrip(
      `<% users.each do |user| %>Content<% rescue %>Error<% else %>OK<% ensure %>Cleanup<% end %>`,
      true,
      eachNodes
    )
  })

  test("can print nested each blocks", () => {
    expectPrintRoundTrip(
      `<% groups.each do |group| %><% group.users.each do |user| %><%= user %><% end %><% end %>`,
      true,
      eachNodes
    )
  })

  test("can print each block inside an HTML element", () => {
    expectPrintRoundTrip(`<ul><% users.each do |user| %><li><%= user %></li><% end %></ul>`, true, eachNodes)
  })

  test("can print multiline each block from source", () => {
    expectPrintRoundTrip(
      dedent`
        <ul>
          <% users.each do |user| %>
            <li><%= user.name %></li>
          <% end %>
        </ul>
      `,
      true,
      eachNodes
    )
  })

  test("prints identically with and without each_nodes enabled", () => {
    const sources = [
      `<% users.each do |user| %><%= user %><% end %>`,
      `<% users.each { |user| %><%= user %><% } %>`,
      `<%= users.each do |user| %><%= user %><% end %>`,
      `<ul><% users.each do |user| %><li><%= user %></li><% end %></ul>`,
      `<% groups.each do |group| %><% group.users.each do |user| %><%= user %><% end %><% end %>`,
      `<% users.each do |user| %>Content<% rescue %>Error<% ensure %>Cleanup<% end %>`
    ]

    for (const source of sources) {
      expectPrintRoundTrip(source, true, {})
      expectPrintRoundTrip(source, true, eachNodes)
    }
  })
})
