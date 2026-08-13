import { describe, it } from "vitest"
import dedent from "dedent"

import { ERBPreferDoEndBlocksRule } from "../../src/rules/erb-prefer-do-end-blocks"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(ERBPreferDoEndBlocksRule)

describe("erb-prefer-do-end-blocks", () => {
  it("flags a brace block that spans multiple ERB tags", () => {
    expectError("Avoid using `{ ... }` for a block that spans multiple ERB tags. Use `do ... end` instead.")

    assertOffenses(dedent`
      <% @users.each { |user| %>
        <p><%= user.name %></p>
      <% } %>
    `)
  })

  it("reports the offense on the opening brace", () => {
    expectError("Avoid using `{ ... }` for a block that spans multiple ERB tags. Use `do ... end` instead.", [1, 15])

    assertOffenses(dedent`
      <% @users.each { |user| %>
        <p><%= user.name %></p>
      <% } %>
    `)
  })

  it("flags a brace block in an output tag", () => {
    expectError("Avoid using `{ ... }` for a block that spans multiple ERB tags. Use `do ... end` instead.")

    assertOffenses(dedent`
      <%= form_with(model: @user) { |form| %>
        <%= form.submit %>
      <% } %>
    `)
  })

  it("flags a brace block without block arguments", () => {
    expectError("Avoid using `{ ... }` for a block that spans multiple ERB tags. Use `do ... end` instead.")

    assertOffenses(dedent`
      <% @users.each { %>
        <p>Hello</p>
      <% } %>
    `)
  })

  it("flags a brace block with a trimming tag closing", () => {
    expectError("Avoid using `{ ... }` for a block that spans multiple ERB tags. Use `do ... end` instead.")

    assertOffenses(dedent`
      <%- @users.each { |user| -%>
        <p><%= user.name %></p>
      <%- } -%>
    `)
  })

  it("flags a brace block whose opening tag spans multiple lines", () => {
    expectError("Avoid using `{ ... }` for a block that spans multiple ERB tags. Use `do ... end` instead.", [1, 15])

    assertOffenses(dedent`
      <% @users.each { |user|
      %>
        <p><%= user.name %></p>
      <% } %>
    `)
  })

  it("flags nested brace blocks separately", () => {
    expectError("Avoid using `{ ... }` for a block that spans multiple ERB tags. Use `do ... end` instead.", [1, 15])
    expectError("Avoid using `{ ... }` for a block that spans multiple ERB tags. Use `do ... end` instead.", [2, 21])

    assertOffenses(dedent`
      <% @users.each { |user| %>
        <% user.posts.each { |post| %>
          <p><%= post.title %></p>
        <% } %>
      <% } %>
    `)
  })

  it("reports the brace that opens the block, not one from an inner chained block", () => {
    expectError("Avoid using `{ ... }` for a block that spans multiple ERB tags. Use `do ... end` instead.", [1, 41])

    assertOffenses(dedent`
      <% @users.map { |user| user.posts }.each { |posts| %>
        <p><%= posts.size %></p>
      <% } %>
    `)
  })

  it("does not flag a `do`/`end` block", () => {
    expectNoOffenses(dedent`
      <% @users.each do |user| %>
        <p><%= user.name %></p>
      <% end %>
    `)
  })

  it("does not flag a brace block contained in a single ERB tag", () => {
    expectNoOffenses(`<% @users.each { |user| user.touch } %>`)
  })

  it("does not flag a hash literal in a `do`/`end` block", () => {
    expectNoOffenses(dedent`
      <%= form_with(model: @user, html: { class: "form" }) do |form| %>
        <%= form.submit %>
      <% end %>
    `)
  })

  it("does not flag an interpolated string containing braces", () => {
    expectNoOffenses(dedent`
      <% @users.each do |user| %>
        <p><%= "Hello #{user.name}" %></p>
      <% end %>
    `)
  })

  it("does not flag a conditional", () => {
    expectNoOffenses(dedent`
      <% if @user.admin? %>
        <p>Admin</p>
      <% end %>
    `)
  })
})
