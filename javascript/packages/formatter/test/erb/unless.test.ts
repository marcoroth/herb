import dedent from "dedent"

import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Formatter } from "../../src"

let formatter: Formatter

describe("@herb-tools/formatter", () => {
  beforeAll(async () => {
    await Herb.load()

    formatter = new Formatter(Herb, {
      indentWidth: 2,
      maxLineLength: 80
    })
  })

  test("formats an ERB unless statement", () => {
    const input = dedent`
      <% unless user.admin? %>
      <%= link_to "User Dashboard", user_dashboard_path %>
      <% end %>
    `

    const expected = dedent`
      <% unless user.admin? %>
        <%= link_to "User Dashboard", user_dashboard_path %>
      <% end %>
    `

    const output = formatter.format(input)

    expect(output).toEqual(expected)
  })

  test("formats an ERB unless statement with else (bug reproduction from issue #391)", () => {
    const input = dedent`
      <% unless some_condition %>
        <span>foo</span>
      <% else %>
        <span>bar</span>
      <% end %>
    `

    const expected = dedent`
      <% unless some_condition %>
        <span>foo</span>
      <% else %>
        <span>bar</span>
      <% end %>
    `

    const output = formatter.format(input)

    expect(output).toEqual(expected)
  })

  test("formats an ERB unless statement with multiple lines in each block", () => {
    const input = dedent`
      <% unless user.admin? %>
      <%= link_to "User Dashboard 1", user_dashboard_path %>
      <%= link_to "User Dashboard 2", user_dashboard_path %>
      <% else %>
      <%= link_to "Admin Dashboard 1", admin_dashboard_path %>
      <%= link_to "Admin Dashboard 2", admin_dashboard_path %>
      <% end %>
    `

    const expected = dedent`
      <% unless user.admin? %>
        <%= link_to "User Dashboard 1", user_dashboard_path %>
        <%= link_to "User Dashboard 2", user_dashboard_path %>
      <% else %>
        <%= link_to "Admin Dashboard 1", admin_dashboard_path %>
        <%= link_to "Admin Dashboard 2", admin_dashboard_path %>
      <% end %>
    `

    const output = formatter.format(input)

    expect(output).toEqual(expected)
  })

  test("unless without surrounding spaces", () => {
    const input = dedent`
      <%unless user.admin?%>
      <%else%>
      <%end%>
    `

    const expected = dedent`
      <% unless user.admin? %>
      <% else %>
      <% end %>
    `

    const output = formatter.format(input)
    expect(output).toEqual(expected)
  })

  test("nested unless statements", () => {
    const input = dedent`
      <% unless user.admin? %>
        <% unless user.guest? %>
          <span>Regular user content</span>
        <% end %>
      <% end %>
    `

    const expected = dedent`
      <% unless user.admin? %>
        <% unless user.guest? %>
          <span>Regular user content</span>
        <% end %>
      <% end %>
    `

    const output = formatter.format(input)
    expect(output).toEqual(expected)
  })

  describe("guard clauses (modifier unless)", () => {
    test("does not indent content after 'next unless' guard clause", () => {
      const input = dedent`
        <% items.each do |item| %>
        <% next unless item.visible? %>
        <div><%= item.name %></div>
        <% end %>
      `

      const expected = dedent`
        <% items.each do |item| %>
          <% next unless item.visible? %>

          <div><%= item.name %></div>
        <% end %>
      `

      const output = formatter.format(input)
      expect(output).toEqual(expected)
    })

    test("does not indent content after 'return unless' guard clause", () => {
      const input = dedent`
        <% [1, 2].each do %>
        <% return unless @content.present? %>
        <div class="content">
        <%= @content %>
        </div>
        <% end %>
      `

      const expected = dedent`
        <% [1, 2].each do %>
          <% return unless @content.present? %>

          <div class="content"><%= @content %></div>
        <% end %>
      `

      const output = formatter.format(input)
      expect(output).toEqual(expected)
    })

    test("does not indent content after 'break unless' guard clause", () => {
      const input = dedent`
        <% loop do %>
        <% break unless continue_processing? %>
        <div>Processing...</div>
        <% end %>
      `

      const expected = dedent`
        <% loop do %>
          <% break unless continue_processing? %>

          <div>Processing...</div>
        <% end %>
      `

      const output = formatter.format(input)
      expect(output).toEqual(expected)
    })

    test("handles multiple unless guard clauses in sequence", () => {
      const input = dedent`
        <% items.each do |item| %>
        <% next unless item %>
        <% next unless item.active? %>
        <% next unless item.published? %>
        <article>
        <h2><%= item.title %></h2>
        <p><%= item.description %></p>
        </article>
        <% end %>
      `

      const expected = dedent`
        <% items.each do |item| %>
          <% next unless item %>
          <% next unless item.active? %>
          <% next unless item.published? %>

          <article>
            <h2><%= item.title %></h2>
            <p><%= item.description %></p>
          </article>
        <% end %>
      `

      const output = formatter.format(input)
      expect(output).toEqual(expected)
    })

    test("distinguishes between block unless and modifier unless", () => {
      const input = dedent`
        <% items.each do |item| %>
        <% next unless item.visible? %>
        <% unless item.featured? %>
        <div class="regular">
        <%= item.name %>
        </div>
        <% else %>
        <div class="featured">
        <%= item.name %>
        </div>
        <% end %>
        <% end %>
      `

      const expected = dedent`
        <% items.each do |item| %>
          <% next unless item.visible? %>

          <% unless item.featured? %>
            <div class="regular"><%= item.name %></div>
          <% else %>
            <div class="featured"><%= item.name %></div>
          <% end %>
        <% end %>
      `

      const output = formatter.format(input)
      expect(output).toEqual(expected)
    })

    test("handles mixed if and unless modifiers", () => {
      const input = dedent`
        <% products.each do |product| %>
        <% next if product.discontinued? %>
        <% next unless product.in_stock? %>
        <% next if product.price > budget %>
        <% next unless product.available_in_region? %>
        <div class="product">
        <h3><%= product.name %></h3>
        <span class="price">$<%= product.price %></span>
        </div>
        <% end %>
      `

      const expected = dedent`
        <% products.each do |product| %>
          <% next if product.discontinued? %>
          <% next unless product.in_stock? %>
          <% next if product.price > budget %>
          <% next unless product.available_in_region? %>

          <div class="product">
            <h3><%= product.name %></h3>
            <span class="price">$<%= product.price %></span>
          </div>
        <% end %>
      `

      const output = formatter.format(input)
      expect(output).toEqual(expected)
    })

    test("handles guard clauses in nested blocks", () => {
      const input = dedent`
        <% categories.each do |category| %>
        <% next unless category.active? %>
        <section>
        <h2><%= category.name %></h2>
        <% category.items.each do |item| %>
        <% next if item.hidden? %>
        <% next unless item.published? %>
        <div><%= item.title %></div>
        <% end %>
        </section>
        <% end %>
      `

      const expected = dedent`
        <% categories.each do |category| %>
          <% next unless category.active? %>

          <section>
            <h2><%= category.name %></h2>

            <% category.items.each do |item| %>
              <% next if item.hidden? %>
              <% next unless item.published? %>

              <div><%= item.title %></div>
            <% end %>
          </section>
        <% end %>
      `

      const output = formatter.format(input)
      expect(output).toEqual(expected)
    })
  })
})
