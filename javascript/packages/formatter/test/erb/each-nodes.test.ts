import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Formatter } from "../../src"
import { createExpectFormattedToMatch } from "../helpers.js"

import dedent from "dedent"

let formatter: Formatter
let eachFormatter: Formatter
let expectFormattedToMatch: ReturnType<typeof createExpectFormattedToMatch>

const SOURCES = [
  `<% users.each do |user| %><%= user %><% end %>`,
  `<% users.each do %><p>user</p><% end %>`,
  `<% pairs.each do |key, value| %><%= key %><%= value %><% end %>`,
  `<%= users.each do |user| %><%= user %><% end %>`,
  `<% users&.each do |user| %><%= user %><% end %>`,
  `<% users.sort.each do |user| %><%= user %><% end %>`,
  `<ul><% users.each do |user| %><li><%= user %></li><% end %></ul>`,
  `<% groups.each do |group| %><% group.users.each do |user| %><%= user %><% end %><% end %>`,
  `<% users.each do |user| %>OK<% rescue %>ERR<% ensure %>FIN<% end %>`,
  `<% users.each_with_index do |user, index| %><%= index %><% end %>`
]

describe("@herb-tools/formatter - Each Nodes", () => {
  beforeAll(async () => {
    await Herb.load()

    const options = { indentWidth: 2, maxLineLength: 80 }

    formatter = new Formatter(Herb, options)
    eachFormatter = new Formatter(Herb, options, { each_nodes: true })

    expectFormattedToMatch = createExpectFormattedToMatch(eachFormatter)
  })

  test("each_nodes does not change formatting output", () => {
    for (const source of SOURCES) {
      expect(eachFormatter.format(source), source).toEqual(formatter.format(source))
    }
  })

  test("formats each block", () => {
    const result = eachFormatter.format(`<% users.each do |user| %><%= user %><% end %>`)

    expect(result).toEqual(dedent`
      <% users.each do |user| %>
        <%= user %>
      <% end %>
    `)
  })

  test("formats each block without block parameters", () => {
    const result = eachFormatter.format(`<% users.each do %><p>user</p><% end %>`)

    expect(result).toEqual(dedent`
      <% users.each do %>
        <p>user</p>
      <% end %>
    `)
  })

  test("formats each block with rescue and ensure", () => {
    const result = eachFormatter.format(`<% users.each do |user| %>OK<% rescue %>ERR<% ensure %>FIN<% end %>`)

    expect(result).toEqual(dedent`
      <% users.each do |user| %>
        OK
      <% rescue %>
        ERR
      <% ensure %>
        FIN
      <% end %>
    `)
  })

  test("formats nested each blocks", () => {
    const result = eachFormatter.format(
      `<% groups.each do |group| %><% group.users.each do |user| %><%= user %><% end %><% end %>`
    )

    expect(result).toEqual(dedent`
      <% groups.each do |group| %>
        <% group.users.each do |user| %>
          <%= user %>
        <% end %>
      <% end %>
    `)
  })

  test("formats each block inside an HTML element", () => {
    const result = eachFormatter.format(`<ul><% users.each do |user| %><li><%= user %></li><% end %></ul>`)

    expect(result).toEqual(dedent`
      <ul>
        <% users.each do |user| %>
          <li><%= user %></li>
        <% end %>
      </ul>
    `)
  })

  test("already formatted each blocks stay unchanged", () => {
    expectFormattedToMatch(dedent`
      <ul>
        <% users.each do |user| %>
          <li><%= user.name %></li>
        <% end %>
      </ul>
    `)
  })

  test("formats each block as an output tag", () => {
    const result = eachFormatter.format(`<%= users.each do |user| %><%= user %><% end %>`)

    expect(result).toEqual(dedent`
      <%= users.each do |user| %>
        <%= user %>
      <% end %>
    `)
  })
})
