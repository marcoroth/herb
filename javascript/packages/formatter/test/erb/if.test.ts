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

  test("formats an ERB if statement", () => {
    const input = dedent`
      <% if user.admin? %>
      <%= link_to "Admin Dashboard", admin_dashboard_path %>
      <% end %>
    `

    const expected = dedent`
      <% if user.admin? %>
        <%= link_to "Admin Dashboard", admin_dashboard_path %>
      <% end %>
    `

    const output = formatter.format(input)

    expect(output).toEqual(expected)
  })

  test("formats an ERB if statement with multiple lines", () => {
    const input = dedent`
      <% if user.admin? %>
      <%= link_to "Admin Dashboard 1", admin_dashboard_path %>
      <%= link_to "Admin Dashboard 2", admin_dashboard_path %>
      <% else %>
      <%= link_to "User Dashboard 1", user_dashboard_path %>
      <%= link_to "User Dashboard 2", user_dashboard_path %>
      <% end %>
    `

    const expected = dedent`
      <% if user.admin? %>
        <%= link_to "Admin Dashboard 1", admin_dashboard_path %>
        <%= link_to "Admin Dashboard 2", admin_dashboard_path %>
      <% else %>
        <%= link_to "User Dashboard 1", user_dashboard_path %>
        <%= link_to "User Dashboard 2", user_dashboard_path %>
      <% end %>
    `

    const output = formatter.format(input)

    expect(output).toEqual(expected)
  })

  test("formats ERB if/elsif/else statement", () => {
    const input = dedent`
      <% if user.admin? %>
      <p>Admin content</p>
      <% elsif user.moderator? %>
      <p>Moderator content</p>
      <% elsif user.member? %>
      <p>Member content</p>
      <% else %>
      <p>Guest content</p>
      <% end %>
    `

    const expected = dedent`
      <% if user.admin? %>
        <p>Admin content</p>
      <% elsif user.moderator? %>
        <p>Moderator content</p>
      <% elsif user.member? %>
        <p>Member content</p>
      <% else %>
        <p>Guest content</p>
      <% end %>
    `

    const output = formatter.format(input)
    expect(output).toEqual(expected)
  })

  test("formats ERB if with only elsif", () => {
    const input = dedent`
      <% if condition_1 %>
      <p>First condition</p>
      <% elsif condition_2 %>
      <p>Second condition</p>
      <% end %>
    `

    const expected = dedent`
      <% if condition_1 %>
        <p>First condition</p>
      <% elsif condition_2 %>
        <p>Second condition</p>
      <% end %>
    `

    const output = formatter.format(input)
    expect(output).toEqual(expected)
  })

  test("if without surrounding spaces", () => {
    const input = dedent`
      <%if user.admin?%>
      <%else%>
      <%end%>
    `

    const expected = dedent`
      <% if user.admin? %>
      <% else %>
      <% end %>
    `

    const output = formatter.format(input)
    expect(output).toEqual(expected)
  })

  describe("guard clauses (modifier if)", () => {
    test("does not indent content after 'next if' guard clause", () => {
      const input = dedent`
        <% [1,2].each do |value| %>
        <% next if false %>
        <div></div>
        <% end %>
      `

      const expected = dedent`
        <% [1,2].each do |value| %>
          <% next if false %>
          <div></div>
        <% end %>
      `

      const output = formatter.format(input)
      expect(output).toEqual(expected)
    })

    test("does not indent content after 'return if' guard clause", () => {
      const input = dedent`
        <% (1..10).each do %>
        <% return if condition %>
        <div>Content</div>
        <p>More content</p>
        <% end %>
      `

      const expected = dedent`
        <% (1..10).each do %>
          <% return if condition %>
          <div>Content</div>

          <p>More content</p>
        <% end %>
      `

      const output = formatter.format(input)
      expect(output).toEqual(expected)
    })

    test("does not indent content after 'break if' guard clause", () => {
      const input = dedent`
        <% loop do %>
        <% break if done %>
        <div>Loop content</div>
        <% end %>
      `

      const expected = dedent`
        <% loop do %>
          <% break if done %>
          <div>Loop content</div>
        <% end %>
      `

      const output = formatter.format(input)
      expect(output).toEqual(expected)
    })

    test("handles multiple guard clauses in sequence", () => {
      const input = dedent`
        <% items.each do |item| %>
        <% next if item.nil? %>
        <% next if item.hidden? %>
        <div><%= item.name %></div>
        <% end %>
      `

      const expected = dedent`
        <% items.each do |item| %>
          <% next if item.nil? %>
          <% next if item.hidden? %>
          <div><%= item.name %></div>
        <% end %>
      `

      const output = formatter.format(input)
      expect(output).toEqual(expected)
    })

    test("handles guard clause with unless modifier", () => {
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

    test("distinguishes between block if and modifier if", () => {
      const input = dedent`
        <% items.each do |item| %>
        <% next if item.skip? %>
        <% if item.special? %>
        <div class="special"><%= item.name %></div>
        <% else %>
        <div><%= item.name %></div>
        <% end %>
        <% end %>
      `

      const expected = dedent`
        <% items.each do |item| %>
          <% next if item.skip? %>
          <% if item.special? %>
            <div class="special"><%= item.name %></div>
          <% else %>
            <div><%= item.name %></div>
          <% end %>
        <% end %>
      `

      const output = formatter.format(input)
      expect(output).toEqual(expected)
    })

    test("if inside <span>", () => {
      const input = dedent`
        <span>
          <% if valid? %>
            Valid
          <% else %>
            Invalid
          <% end %>
        </span>
      `

      const expected = dedent`
        <span><% if valid? %>Valid<% else %>Invalid<% end %></span>
      `

      const output = formatter.format(input)
      expect(output).toEqual(expected)
    })

    test("if/elseif inside <span>", () => {
      const input = dedent`
        <span>
          <% if valid? %>
            Valid
          <% elsif invalid? %>
            Invalid
          <% end %>
        </span>
      `

      const expected = dedent`
        <span><% if valid? %>Valid<% elsif invalid? %>Invalid<% end %></span>
      `

      const output = formatter.format(input)
      expect(output).toEqual(expected)
    })

    test("if/elseif/else inside <span>", () => {
      const input = dedent`
        <span>
          <% if valid? %>
            Valid
          <% elsif invalid? %>
            Invalid
          <% else %>
            Unknown
          <% end %>
        </span>
      `

      const expected = dedent`
        <span><% if valid? %>Valid<% elsif invalid? %>Invalid<% else %>Unknown<% end %></span>
      `

      const output = formatter.format(input)
      expect(output).toEqual(expected)
    })
  })
})
