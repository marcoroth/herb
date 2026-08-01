import { describe, it } from "vitest"
import dedent from "dedent"

import { ActionViewPreferCollectionRenderRule } from "../../src/rules/actionview-prefer-collection-render"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(ActionViewPreferCollectionRenderRule)

describe("actionview-prefer-collection-render", () => {
  it("flags a partial rendered once per iteration with an implicit local", () => {
    const html = dedent`
      <% @users.each do |user| %>
        <%= render "user", user: user %>
      <% end %>
    `

    expectError('Prefer `<%= render partial: "user", collection: @users %>` over rendering a partial once per iteration. Collection rendering builds the partial once instead of for every item.')

    assertOffenses(html)
  })

  it("flags a partial rendered with an explicit locals hash", () => {
    const html = dedent`
      <% @users.each do |user| %>
        <%= render partial: "user", locals: { user: user } %>
      <% end %>
    `

    expectError('Prefer `<%= render partial: "user", collection: @users %>` over rendering a partial once per iteration. Collection rendering builds the partial once instead of for every item.')

    assertOffenses(html)
  })

  it("flags the object shorthand and suggests the shorthand collection form", () => {
    const html = dedent`
      <% @users.each do |user| %>
        <%= render user %>
      <% end %>
    `

    expectError('Prefer `<%= render @users %>` over rendering a partial once per iteration. Collection rendering builds the partial once instead of for every item.')

    assertOffenses(html)
  })

  it("uses the full receiver expression in the suggestion", () => {
    const html = dedent`
      <% current_user.posts.each do |post| %>
        <%= render "post", post: post %>
      <% end %>
    `

    expectError('Prefer `<%= render partial: "post", collection: current_user.posts %>` over rendering a partial once per iteration. Collection rendering builds the partial once instead of for every item.')

    assertOffenses(html)
  })

  it("does not flag a loop that already uses collection rendering", () => {
    expectNoOffenses(dedent`
      <%= render partial: "user", collection: @users %>
    `)
  })

  it("does not flag when the body has markup around the render", () => {
    expectNoOffenses(dedent`
      <% @users.each do |user| %>
        <li><%= render "user", user: user %></li>
      <% end %>
    `)
  })

  it("does not flag when the body renders more than the partial", () => {
    expectNoOffenses(dedent`
      <% @users.each do |user| %>
        <%= render "user", user: user %>
        <%= user.email %>
      <% end %>
    `)
  })

  it("does not flag when the local is not the block argument", () => {
    expectNoOffenses(dedent`
      <% @users.each do |user| %>
        <%= render "user", user: current_user %>
      <% end %>
    `)
  })

  it("does not flag when extra locals are passed", () => {
    expectNoOffenses(dedent`
      <% @users.each do |user| %>
        <%= render "user", user: user, admin: true %>
      <% end %>
    `)
  })

  it("does not flag when the block takes more than one argument", () => {
    expectNoOffenses(dedent`
      <% @users.each_with_index do |user, index| %>
        <%= render "user", user: user %>
      <% end %>
    `)
  })

  it("does not flag iteration methods other than each", () => {
    expectNoOffenses(dedent`
      <% @users.map do |user| %>
        <%= render "user", user: user %>
      <% end %>
    `)
  })

  it("does not flag a silent render", () => {
    expectNoOffenses(dedent`
      <% @users.each do |user| %>
        <% render "user", user: user %>
      <% end %>
    `)
  })

  it("does not flag a loop without a render", () => {
    expectNoOffenses(dedent`
      <% @users.each do |user| %>
        <%= user.name %>
      <% end %>
    `)
  })

  it("does not flag a block that is not an iteration", () => {
    expectNoOffenses(dedent`
      <%= form_with model: @user do |form| %>
        <%= render "field", field: form %>
      <% end %>
    `)
  })

  it("flags the inner loop of nested iteration", () => {
    const html = dedent`
      <% @groups.each do |group| %>
        <h2><%= group.name %></h2>

        <% group.users.each do |user| %>
          <%= render "user", user: user %>
        <% end %>
      <% end %>
    `

    expectError('Prefer `<%= render partial: "user", collection: group.users %>` over rendering a partial once per iteration. Collection rendering builds the partial once instead of for every item.')

    assertOffenses(html)
  })
})
