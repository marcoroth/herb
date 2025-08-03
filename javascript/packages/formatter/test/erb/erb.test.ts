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

  test("formats simple HTML with ERB content", () => {
    const source = '<div><%= "Hello" %> World</div>'
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <div><%= "Hello" %> World</div>
    `)
  })

  test("formats standalone ERB", () => {
    const source = '<% title %>'
    const result = formatter.format(source)
    expect(result).toEqual(`<% title %>`)
  })

  test("formats nested blocks with final example", () => {
    const source = `
      <div id="output">
        <%= tag.div class: "div" do %>
          <% if true %><span>OK</span><% else %><span>NO</span><% end %>
        <% end %>
      </div>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <div id="output">
        <%= tag.div class: "div" do %>
          <% if true %>
            <span>OK</span>
          <% else %>
            <span>NO</span>
          <% end %>
        <% end %>
      </div>
    `)
  })

  test("preserves ERB within HTML attributes and content", () => {
    const source = dedent`
      <div>
        <h1 class="<%= classes %>">
          <%= title %>
        </h1>
      </div>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <div>
        <h1 class="<%= classes %>">
          <%= title %>
        </h1>
      </div>
    `)
  })

  test("should not add extra % to ERB closing tags with quoted strings", () => {
    const input = dedent`
      <div>
        <%= link_to "Nederlands", url_for(locale: 'nl'), class: "px-4 py-2 hover:bg-slate-100 rounded block" %>
        <%= link_to "Français", url_for(locale: 'fr'), class: "px-4 py-2 hover:bg-slate-100 rounded block" %>
        <%= link_to "English", url_for(locale: 'en'), class: "px-4 py-2 hover:bg-slate-100 rounded block" %>
      </div>
    `

    const result = formatter.format(input)
    expect(result).toBe(input)
  })

  test("should handle complex ERB in layout files", () => {
    const input = dedent`
      <div class="container flex px-5 mx-auto mt-6">
        <% if notice.present? %>
          <div class="block">
            <p class="inline-block px-5 py-2 mb-5 font-medium text-green-500 rounded bg-green-50" id="notice"><%= notice %></p>
          </div>
        <% end %>
      </div>
    `

    const result = formatter.format(input)

    expect(result).not.toContain("% %>")
    expect(result).toContain("<% if notice.present? %>")
    expect(result).toContain("<% end %>")
    expect(result).toContain("<%= notice %>")
  })

  test("handles ERB tags ending with various patterns", () => {
    const inputs = [
      '<%= link_to "test" %>',
      '<%= link_to "test", class: "btn" %>',
      '<%= render "partial" %>',
      '<% if something? %>',
      '<%= tag.div("content") %>'
    ]

    inputs.forEach(input => {
      const result = formatter.format(input)
      expect(result).not.toContain("% %>")
      expect(result).toBe(input)
    })
  })
})
