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

    test("if/elsif/else inside <span>", () => {
      const input = dedent`
        <span>
          <% if status == 'active' %>
            Active
          <% elsif status == 'pending' %>
            Pending
          <% else %>
            Inactive
          <% end %>
        </span>
      `

      const expected = dedent`
        <span>
          <% if status == 'active' %>
            Active
          <% elsif status == 'pending' %>
            Pending
          <% else %>
            Inactive
          <% end %>
        </span>
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

      const output = formatter.format(input)
      expect(output).toEqual(expected)
    })

    test("long if/elsif chain with method calls - breaks at ERB boundaries", () => {
      const input = dedent`
        <span>
          <% if user.role == 'admin' %>
            <%= link_to "Admin Dashboard", admin_path(user_id: user.id, features: :all) %>
          <% elsif user.role == 'moderator' %>
            <%= link_to "Moderator Panel", moderator_path(user_id: user.id, features: :all) %>
          <% else %>
            <%= link_to "User Profile", profile_path(user_id: user.id, features: :basic) %>
          <% end %>
        </span>
      `
      const output = formatter.format(input)
      expect(output).toEqual(input)
    })

    test("if with multiple consecutive ERB outputs - breaks at ERB boundaries", () => {
      const input = dedent`
        <div>
          <span>
            <% if show_full_name? %>
              <%= user.first_name %>
              <%= user.middle_name %>
              <%= user.last_name %>
              <%= user.suffix %>
              -
              <%= formatted_date(user.birth_date, format: :long) %>
            <% end %>
          </span>
        </div>
      `
      const output = formatter.format(input)
      expect(output).toEqual(input)
    })

    test("if with mixed inline HTML elements - breaks at ERB boundaries", () => {
      const input = dedent`
        <p>
          <% if user.premium? %>
            <strong><%= user.name %></strong>
            <em>(Premium Member since <%= user.premium_since.strftime("%B %Y") %>)</em>
          <% else %>
            <%= user.name %>
          <% end %>
        </p>
      `
      const output = formatter.format(input)
      expect(output).toEqual(input)
    })
  })

  describe("no whitespace introduction on single-line ERB", () => {
    test("short if/else stays on one line without introducing whitespace", () => {
      const input = `<span><% if active? %>Active<% else %>Inactive<% end %></span>`
      const output = formatter.format(input)
      expect(output).toEqual(input)
    })

    test("short if/elsif/else stays on one line without whitespace", () => {
      const input = `<span><% if x == 1 %>One<% elsif x == 2 %>Two<% else %>Other<% end %></span>`
      const output = formatter.format(input)
      expect(output).toEqual(input)
    })

    test("short if with ERB output stays on one line without whitespace", () => {
      const input = `<span><% if valid? %><%= name %><% else %><%= default %><% end %></span>`
      const output = formatter.format(input)
      expect(output).toEqual(input)
    })

    test("multiple inline elements with short if/else - no whitespace", () => {
      const input = `<div><span><% if ok? %>Yes<% else %>No<% end %></span><span>Text</span></div>`
      const output = formatter.format(input)
      expect(output).toEqual(input)
    })

    test("short nested if statements stay inline - no whitespace", () => {
      const input = `<span><% if a %><% if b %>AB<% else %>A<% end %><% else %>None<% end %></span>`
      const output = formatter.format(input)
      expect(output).toEqual(input)
    })

    test("short if with inline HTML elements - no whitespace", () => {
      const input = `<span><% if premium? %><strong>Pro</strong><% else %>Free<% end %></span>`
      const output = formatter.format(input)
      expect(output).toEqual(input)
    })
  })
})
