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

  test("formats ERB for/in loops with nested HTML", () => {
    const source = dedent`
      <% for item in list %><li><%= item.name %></li><% end %>
    `
    const result = formatter.format(source)

    expect(result).toEqual(dedent`
      <% for item in list %>
        <li><%= item.name %></li>
      <% end %>
    `)
  })

  test("formats ERB for loop with multiple iterations", () => {
    const input = dedent`
      <% for user in @users %>
      <div class="user">
      <h3><%= user.name %></h3>
      <p><%= user.email %></p>
      </div>
      <% end %>
    `

    const expected = dedent`
      <% for user in @users %>
        <div class="user">
          <h3><%= user.name %></h3>
          <p><%= user.email %></p>
        </div>
      <% end %>
    `

    const output = formatter.format(input)
    expect(output).toEqual(expected)
  })

  test("formats ERB for loop with array range", () => {
    const input = dedent`
      <% for i in 1..5 %>
      <span>Number <%= i %></span>
      <% end %>
    `

    const expected = dedent`
      <% for i in 1..5 %>
        <span>Number <%= i %></span>
      <% end %>
    `

    const output = formatter.format(input)
    expect(output).toEqual(expected)
  })

  test("formats nested for loops", () => {
    const input = dedent`
      <% for category in categories %>
      <h2><%= category.name %></h2>
      <% for product in category.products %>
      <p><%= product.name %> - $<%= product.price %></p>
      <% end %>
      <% end %>
    `

    const expected = dedent`
      <% for category in categories %>
        <h2><%= category.name %></h2>
        <% for product in category.products %>
          <p><%= product.name %> - $<%= product.price %></p>
        <% end %>
      <% end %>
    `

    const output = formatter.format(input)
    expect(output).toEqual(expected)
  })

  test("for without surrounding spaces", () => {
    const input = dedent`
      <%for item in items%>
      <%end%>
    `

    const expected = dedent`
      <% for item in items %>
      <% end %>
    `

    const output = formatter.format(input)
    expect(output).toEqual(expected)
  })

  test("formats .each loop with inline elements containing long ERB output - breaks at ERB boundaries", () => {
    const input = dedent`
      <div>
        <span>
          <% [10, 20, 30, 50, 100].each do |per| %>
            <%= link_to_unless per_page == per, per.to_s, params.merge({ action:, page: 1, per:, remote: }) %>
          <% end %>
        </span>
      </div>
    `
    const output = formatter.format(input)
    expect(output).toEqual(input)
  })

  test("formats nested .each loops with long content - breaks at ERB boundaries", () => {
    const input = dedent`
      <div>
        <span>
          <% categories.each do |category| %>
            <% category.items.each do |item| %>
              <%= link_to item.name, item_path(item, category_id: category.id, display: :full) %>
            <% end %>
          <% end %>
        </span>
      </div>
    `
    const output = formatter.format(input)
    expect(output).toEqual(input)
  })

  test("formats for loop with range and long output - breaks at ERB boundaries", () => {
    const input = dedent`
      <div>
        <span>
          <% for page_num in 1..total_pages %>
            <%= link_to_unless current_page == page_num, page_num, url_for(params.merge(page: page_num)) %>
          <% end %>
        </span>
      </div>
    `
    const output = formatter.format(input)
    expect(output).toEqual(input)
  })

  test("formats .each with complex expression and long output - breaks at ERB boundaries", () => {
    const input = dedent`
      <div>
        <ul>
          <% items.select(&:active?).sort_by(&:priority).each do |item| %>
            <li><%= link_to item.display_name, item_path(item, locale: I18n.locale, format: :html) %></li>
          <% end %>
        </ul>
      </div>
    `

    const expected = dedent`
      <div>
        <ul>
          <% items.select(&:active?).sort_by(&:priority).each do |item| %>
            <li>
              <%= link_to item.display_name, item_path(item, locale: I18n.locale, format: :html) %>
            </li>
          <% end %>
        </ul>
      </div>
    `

    const output = formatter.format(input)
    expect(output).toEqual(expected)
  })

  describe("no whitespace introduction on single-line loops", () => {
    test("short .each loop stays on one line without whitespace", () => {
      const input = `<span><% [1, 2, 3].each do |i| %><%= i %><% end %></span>`
      const output = formatter.format(input)
      expect(output).toEqual(input)
    })

    test("short for loop stays on one line without whitespace", () => {
      const input = `<span><% for i in 1..3 %><%= i %><% end %></span>`
      const output = formatter.format(input)
      expect(output).toEqual(input)
    })

    test("short .each with only ERB output stays on one line - no whitespace", () => {
      const input = `<span><% [1, 2].each do |i| %><%= i %><% end %></span>`
      const output = formatter.format(input)
      expect(output).toEqual(input)
    })

    test("short .each with conditional stays on one line - no whitespace", () => {
      const input = `<span><% items.each do |item| %><% if item %>X<% end %><% end %></span>`
      const output = formatter.format(input)
      expect(output).toEqual(input)
    })

    test("nested short loops stay on one line - no whitespace", () => {
      const input = `<span><% rows.each do |r| %><% r.each do |c| %><%= c %><% end %><% end %></span>`
      const output = formatter.format(input)
      expect(output).toEqual(input)
    })

    test("short loop with inline link stays on one line - no whitespace", () => {
      const input = `<span><% pages.each do |p| %><a href="#"><%= p %></a><% end %></span>`
      const output = formatter.format(input)
      expect(output).toEqual(input)
    })
  })
})
