import dedent from "dedent"
import { describe, test } from "vitest"

import { ActionViewNoSilentHelperRule } from "../../src/rules/actionview-no-silent-helper.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(ActionViewNoSilentHelperRule)

describe("ActionViewNoSilentHelperRule", () => {
  test("output tag with link_to is allowed", () => {
    expectNoOffenses(dedent`
      <%= link_to "Home", root_path %>
    `)
  })

  test("output tag with link_to in conditional is allowed", () => {
    expectNoOffenses(dedent`
      <% if admin? %>
        <%= link_to "Admin", admin_path %>
      <% end %>
    `)
  })

  test("output tag with link_to in loop is allowed", () => {
    expectNoOffenses(dedent`
      <% ["Herb", "Home"].each do %>
        <%= link_to it, home_path %>
      <% end %>
    `)
  })

  test("output tag with form_with is allowed", () => {
    expectNoOffenses(dedent`
      <%= form_with model: @user do |f| %>
        <%= f.text_field :name %>
      <% end %>
    `)
  })

  test("output tag with button_to is allowed", () => {
    expectNoOffenses(dedent`
      <%= button_to "Delete", user_path(@user), method: :delete %>
    `)
  })

  test("output tag with content_tag is allowed", () => {
    expectNoOffenses(dedent`
      <%= content_tag :div, "Hello", class: "greeting" %>
    `)
  })

  test("regular HTML elements are allowed", () => {
    expectNoOffenses(dedent`
      <div class="container">
        <p>Hello</p>
      </div>
    `)
  })

  test("silent ERB statements are allowed", () => {
    expectNoOffenses(dedent`
      <% if true %>
        <p>Hello</p>
      <% end %>
    `)
  })

  test("silent tag with link_to is not allowed", () => {
    expectError("Avoid using `<% %>` with `link_to`. Use `<%= %>` to ensure the helper's output is rendered.")

    assertOffenses(dedent`
      <% link_to "Home", root_path %>
    `)
  })

  test("silent tag with content_tag is not allowed", () => {
    expectError("Avoid using `<% %>` with `content_tag`. Use `<%= %>` to ensure the helper's output is rendered.")

    assertOffenses(dedent`
      <% content_tag :div, "Hello", class: "greeting" %>
    `)
  })

  test("silent tag with turbo_frame_tag is not allowed", () => {
    expectError("Avoid using `<% %>` with `turbo_frame_tag`. Use `<%= %>` to ensure the helper's output is rendered.")

    assertOffenses(dedent`
      <% turbo_frame_tag "test" %>
    `)
  })

  test("trimmed silent tag with link_to is not allowed", () => {
    expectError("Avoid using `<%- %>` with `link_to`. Use `<%= %>` to ensure the helper's output is rendered.")

    assertOffenses(dedent`
      <%- link_to "Home", root_path %>
    `)
  })

  test("escaped ERB output tag with tag.div is allowed", () => {
    expectNoOffenses(dedent`
      <%%= tag.div(content) %>
    `)
  })

  test("escaped ERB tag with link_to is allowed", () => {
    expectNoOffenses(dedent`
      <%%= link_to "Home", root_path %>
    `)
  })

  test("escaped ERB output tag with tag.div and content is allowed", () => {
    expectNoOffenses(dedent`
      <%%= tag.div("Hello", class: "greeting") %>
    `)
  })

  test.fails("escaped ERB output tag with tag.div block is allowed", () => {
    expectNoOffenses(dedent`
      <%%= tag.div do %>
        <p>Hello</p>
      <% end %>
    `)
  })

  test("silent tag with tag.div is not allowed", () => {
    expectError("Avoid using `<% %>` with `tag`. Use `<%= %>` to ensure the helper's output is rendered.")

    assertOffenses(dedent`
      <% tag.div "Hello" %>
    `)
  })

  test("silent tag with postfix conditional is not allowed", () => {
    expectError("Avoid using `<% %>` with `link_to`. Use `<%= %>` to ensure the helper's output is rendered.")

    assertOffenses(dedent`
      <% link_to "Home", root_path if show_link %>
    `)
  })

  test("output tag with postfix conditional is allowed", () => {
    expectNoOffenses(dedent`
      <%= link_to "Home", root_path if show_link %>
    `)
  })
})
