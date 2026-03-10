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
})
