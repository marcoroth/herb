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
