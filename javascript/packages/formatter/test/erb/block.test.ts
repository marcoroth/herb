import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Formatter } from "../../src"

import dedent from "dedent"

let formatter: Formatter

describe("@herb-tools/formatter", () => {
  beforeAll(async () => {
    await Herb.load()

    formatter = new Formatter(Herb, {
      indentWidth: 2,
      maxLineLength: 80
    })
  })

  test("formats block with rescue", () => {
    const source = dedent`
      <% 5.times do %>OK<% rescue %>ERR<% end %>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <% 5.times do %>
        OK
      <% rescue %>
        ERR
      <% end %>
    `)
  })

  test("formats block with rescue and ensure", () => {
    const source = dedent`
      <% 5.times do %>OK<% rescue %>ERR<% ensure %>FIN<% end %>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <% 5.times do %>
        OK
      <% rescue %>
        ERR
      <% ensure %>
        FIN
      <% end %>
    `)
  })

  test("formats block with rescue, else, and ensure", () => {
    const source = dedent`
      <% 5.times do %>OK<% rescue %>ERR<% else %>NONE<% ensure %>FIN<% end %>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <% 5.times do %>
        OK
      <% rescue %>
        ERR
      <% else %>
        NONE
      <% ensure %>
        FIN
      <% end %>
    `)
  })

  test("formats block with typed rescue", () => {
    const input = dedent`
      <% items.each do |item| %>
      <%= item %>
      <% rescue StandardError => e %>
      <p>Error: <%= e.message %></p>
      <% end %>
    `

    const expected = dedent`
      <% items.each do |item| %>
        <%= item %>
      <% rescue StandardError => e %>
        <p>Error: <%= e.message %></p>
      <% end %>
    `

    const output = formatter.format(input)
    expect(output).toEqual(expected)
  })

  test("formats block with rescue and else only", () => {
    const input = dedent`
      <% items.each do |item| %>
      <%= item %>
      <% rescue %>
      <p>Error</p>
      <% else %>
      <p>Success</p>
      <% end %>
    `

    const expected = dedent`
      <% items.each do |item| %>
        <%= item %>
      <% rescue %>
        <p>Error</p>
      <% else %>
        <p>Success</p>
      <% end %>
    `

    const output = formatter.format(input)
    expect(output).toEqual(expected)
  })

  test("formats block with ensure only", () => {
    const input = dedent`
      <% 5.times do %>
      <%= something %>
      <% ensure %>
      <%= cleanup %>
      <% end %>
    `

    const expected = dedent`
      <% 5.times do %>
        <%= something %>
      <% ensure %>
        <%= cleanup %>
      <% end %>
    `

    const output = formatter.format(input)
    expect(output).toEqual(expected)
  })
})
