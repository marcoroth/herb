import dedent from "dedent"
import { describe, test, expect, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { ERBIterationBlockNode } from "@herb-tools/core"

import {
  expectNodeToPrint,
  expectPrintRoundTrip,
  location,
  createToken,
  createTextNode,
  end_node
} from "../helpers/printer-test-helpers.js"

const iterationNodes = { iteration_nodes: true }

describe("ERBIterationBlockNode Printing", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("can print from node", () => {
    const node = ERBIterationBlockNode.from({
      type: "AST_ERB_ITERATION_BLOCK_NODE",
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

  test("is only produced when iteration_nodes is enabled", () => {
    const source = `<% users.each do |user| %><%= user %><% end %>`

    const withoutOption = Herb.parse(source, { track_whitespace: true }).value.children[0]
    const withOption = Herb.parse(source, { track_whitespace: true, ...iterationNodes }).value.children[0]

    expect(withoutOption.type).toBe("AST_ERB_BLOCK_NODE")
    expect(withOption.type).toBe("AST_ERB_ITERATION_BLOCK_NODE")
  })

  test("exposes the receiver, call operator, message and block opening", () => {
    const source = `<% @users.sort.each do |user| %><%= user %><% end %>`
    const node = Herb.parse(source, { track_whitespace: true, ...iterationNodes }).value.children[0] as ERBIterationBlockNode

    expect(node.receiver?.value).toBe("@users.sort")
    expect(node.call_operator?.value).toBe(".")
    expect(node.message?.value).toBe("each")
    expect(node.block_opening?.value).toBe("do")
    expect(node.block_arguments.map(argument => argument.name?.value)).toEqual(["user"])
  })

  test("message identifies which iteration method was used", () => {
    const cases: [string, string, string][] = [
      [`<% @users.each do |user| %><% end %>`, "each", "@users"],
      [`<% @users.each_with_index do |user, index| %><% end %>`, "each_with_index", "@users"],
      [`<% 10.times do |index| %><% end %>`, "times", "10"],
      [`<% 1.upto(5) do |index| %><% end %>`, "upto", "1"],
      [`<% 5.downto(1) do |index| %><% end %>`, "downto", "5"],
      [`<% @users.map do |user| %><% end %>`, "map", "@users"],
      [`<% @users.select do |user| %><% end %>`, "select", "@users"]
    ]

    for (const [source, message, receiver] of cases) {
      const node = Herb.parse(source, { track_whitespace: true, ...iterationNodes }).value.children[0] as ERBIterationBlockNode

      expect(node.type, source).toBe("AST_ERB_ITERATION_BLOCK_NODE")
      expect(node.message?.value, source).toBe(message)
      expect(node.receiver?.value, source).toBe(receiver)
    }
  })

  test("exposes the call arguments with their locations", () => {
    const cases: [string, string[]][] = [
      [`<% @users.each do |user| %><% end %>`, []],
      [`<% @users.each_slice(3) do |group| %><% end %>`, ["3"]],
      [`<% 0.step(10, 2) do |index| %><% end %>`, ["10", "2"]],
      [`<% @users.each_with_object({}) do |user, hash| %><% end %>`, ["{}"]],
      [`<% 1.upto(@max) do |index| %><% end %>`, ["@max"]]
    ]

    for (const [source, expected] of cases) {
      const node = Herb.parse(source, { track_whitespace: true, ...iterationNodes }).value.children[0] as ERBIterationBlockNode

      expect(node.arguments.map(argument => argument.content), source).toEqual(expected)
    }
  })

  test("argument locations point at the argument in the source", () => {
    const source = `<% 0.step(10, 2) do |index| %><% end %>`
    const node = Herb.parse(source, { track_whitespace: true, ...iterationNodes }).value.children[0] as ERBIterationBlockNode

    const slices = node.arguments.map(argument =>
      source.slice(argument.location.start.column, argument.location.end.column)
    )

    expect(slices).toEqual(["10", "2"])
  })

  test("exposes block parameter kinds, requiredness and defaults", () => {
    const source = `<% @items.each do |item, count = 5, *rest, index: 0, key:, **options, &callback| %><% end %>`
    const node = Herb.parse(source, { track_whitespace: true, ...iterationNodes }).value.children[0] as ERBIterationBlockNode

    expect(
      node.block_arguments.map(argument => [
        argument.name?.value,
        argument.kind,
        argument.required,
        argument.default_value?.content ?? null
      ])
    ).toEqual([
      ["item", "positional", true, null],
      ["count", "positional", false, "5"],
      ["rest", "rest", false, null],
      ["index", "keyword", false, "0"],
      ["key", "keyword", true, null],
      ["options", "keyword_rest", false, null],
      ["callback", "block", false, null]
    ])
  })

  test("block parameter default locations point at the default in the source", () => {
    const source = `<% @items.each do |item, total = (item.size * 2)| %><% end %>`
    const node = Herb.parse(source, { track_whitespace: true, ...iterationNodes }).value.children[0] as ERBIterationBlockNode
    const total = node.block_arguments[1]

    expect(total.default_value?.content).toBe("(item.size * 2)")
    expect(
      source.slice(total.default_value!.location.start.column, total.default_value!.location.end.column)
    ).toBe("(item.size * 2)")
  })

  test("flattens destructured and post-rest block parameters", () => {
    const cases: [string, string[]][] = [
      [`<% @pairs.each do |(key, value)| %><% end %>`, ["key", "value"]],
      [`<% @rows.each do |a, (b, c)| %><% end %>`, ["a", "b", "c"]],
      [`<% @rows.each do |(head, *tail)| %><% end %>`, ["head", "tail"]],
      [`<% @rows.each do |(a, (b, c))| %><% end %>`, ["a", "b", "c"]],
      [`<% @rows.each do |first, *middle, last| %><% end %>`, ["first", "middle", "last"]]
    ]

    for (const [source, expected] of cases) {
      const node = Herb.parse(source, { track_whitespace: true, ...iterationNodes }).value.children[0] as ERBIterationBlockNode

      expect(node.block_arguments.map(argument => argument.name?.value), source).toEqual(expected)
    }
  })

  test("builder blocks and non-iteration methods stay ERBBlockNode", () => {
    const sources = [
      `<% form_with model: @user do |form| %><% end %>`,
      `<% @user.tap do |user| %><% end %>`,
      `<% each do |user| %><% end %>`
    ]

    for (const source of sources) {
      const node = Herb.parse(source, { track_whitespace: true, ...iterationNodes }).value.children[0]

      expect(node.type, source).toBe("AST_ERB_BLOCK_NODE")
    }
  })

  test("can print from source", () => {
    expectPrintRoundTrip(`<% users.each do |user| %>Content<% end %>`, true, iterationNodes)
  })

  test("can print iteration block without block parameters", () => {
    expectPrintRoundTrip(`<% users.each do %>Content<% end %>`, true, iterationNodes)
  })

  test("can print iteration block with multiple block parameters", () => {
    expectPrintRoundTrip(`<% pairs.each do |key, value| %><%= key %><%= value %><% end %>`, true, iterationNodes)
  })

  test("can print iteration block with a brace block", () => {
    expectPrintRoundTrip(`<% users.each { |user| %><%= user %><% } %>`, true, iterationNodes)
  })

  test("can print iteration block as an output tag", () => {
    expectPrintRoundTrip(`<%= users.each do |user| %><%= user %><% end %>`, true, iterationNodes)
  })

  test("can print iteration block with safe navigation", () => {
    expectPrintRoundTrip(`<% users&.each do |user| %><%= user %><% end %>`, true, iterationNodes)
  })

  test("can print iteration block with rescue from source", () => {
    expectPrintRoundTrip(`<% users.each do |user| %>Content<% rescue %>Error<% end %>`, true, iterationNodes)
  })

  test("can print iteration block with rescue, else, and ensure from source", () => {
    expectPrintRoundTrip(
      `<% users.each do |user| %>Content<% rescue %>Error<% else %>OK<% ensure %>Cleanup<% end %>`,
      true,
      iterationNodes
    )
  })

  test("can print nested iteration blocks", () => {
    expectPrintRoundTrip(
      `<% groups.each do |group| %><% group.users.each do |user| %><%= user %><% end %><% end %>`,
      true,
      iterationNodes
    )
  })

  test("can print iteration block inside an HTML element", () => {
    expectPrintRoundTrip(`<ul><% users.each do |user| %><li><%= user %></li><% end %></ul>`, true, iterationNodes)
  })

  test("can print multiline iteration block from source", () => {
    expectPrintRoundTrip(
      dedent`
        <ul>
          <% users.each do |user| %>
            <li><%= user.name %></li>
          <% end %>
        </ul>
      `,
      true,
      iterationNodes
    )
  })

  test("prints identically with and without iteration_nodes enabled", () => {
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
      expectPrintRoundTrip(source, true, iterationNodes)
    }
  })
})
