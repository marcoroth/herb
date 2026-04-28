import dedent from "dedent"
import { describe, test, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { ERBBlockNode } from "@herb-tools/core"

import {
  expectNodeToPrint,
  expectPrintRoundTrip,
  location,
  createToken,
  createTextNode,
  end_node
} from "../helpers/printer-test-helpers.js"

describe("ERBBlockNode Printing", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("can print from node", () => {
    const node = ERBBlockNode.from({
      type: "AST_ERB_BLOCK_NODE",
      location,
      errors: [],
      tag_opening: createToken("TOKEN_ERB_START", "<%"),
      content: createToken("TOKEN_ERB_CONTENT", " something do "),
      tag_closing: createToken("TOKEN_ERB_END", "%>"),
      body: [createTextNode("Content")],
      rescue_clause: null,
      else_clause: null,
      ensure_clause: null,
      end_node
    })

    expectNodeToPrint(node, "<% something do %>Content<% end %>")
  })

  test("can print from source", () => {
    expectPrintRoundTrip(`<% something do %>Content<% end %>`)
  })

  test("can print block with rescue from source", () => {
    expectPrintRoundTrip(`<% 5.times do %><% rescue %><% end %>`)
    expectPrintRoundTrip(`<% 5.times do %>Content<% rescue %>Error<% end %>`)
  })

  test("can print block with rescue and ensure from source", () => {
    expectPrintRoundTrip(`<% 5.times do %>Content<% rescue %>Error<% ensure %>Cleanup<% end %>`)
  })

  test("can print block with rescue, else, and ensure from source", () => {
    expectPrintRoundTrip(`<% 5.times do %>Content<% rescue %>Error<% else %>OK<% ensure %>Cleanup<% end %>`)
  })

  test("can print block with multiple rescues from source", () => {
    expectPrintRoundTrip(`<% 5.times do %>Content<% rescue StandardError %>SE<% rescue ArgumentError %>AE<% end %>`)
  })

  test("can print multiline block with rescue from source", () => {
    expectPrintRoundTrip(dedent`
      <% items.each do |item| %>
        <%= item %>
      <% rescue StandardError => e %>
        <%= e.message %>
      <% end %>
    `)

    expectPrintRoundTrip(dedent`
      <% items.each do |item| %>
        <%= item %>
      <% rescue StandardError => e %>
        <%= e.message %>
      <% else %>
        <p>Success</p>
      <% ensure %>
        <p>Cleanup</p>
      <% end %>
    `)
  })
})
