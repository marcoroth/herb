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
})
