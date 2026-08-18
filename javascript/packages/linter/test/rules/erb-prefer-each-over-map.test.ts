import { describe, it } from "vitest"
import dedent from "dedent"

import { ERBPreferEachOverMapRule } from "../../src/rules/erb-prefer-each-over-map"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(ERBPreferEachOverMapRule)

describe("erb-prefer-each-over-map", () => {
  it("flags a silent map block", () => {
    const html = dedent`
      <% @users.map do |user| %>
        <p><%= user.name %></p>
      <% end %>
    `

    expectError('`map` builds a new collection that is then discarded. Use `each` instead, or output the result with `<%= %>`.')

    assertOffenses(html)
  })

  it("reports the offense on the method name", () => {
    const html = dedent`
      <% @users.map do |user| %>
        <p><%= user.name %></p>
      <% end %>
    `

    expectError(
      '`map` builds a new collection that is then discarded. Use `each` instead, or output the result with `<%= %>`.',
      [1, 10]
    )

    assertOffenses(html)
  })

  it("flags select", () => {
    const html = dedent`
      <% @users.select do |user| %>
        <p><%= user.name %></p>
      <% end %>
    `

    expectError('`select` builds a new collection that is then discarded. Use `each` instead, or output the result with `<%= %>`.')

    assertOffenses(html)
  })

  it("flags reject", () => {
    const html = dedent`
      <% @users.reject do |user| %>
        <p><%= user.name %></p>
      <% end %>
    `

    expectError('`reject` builds a new collection that is then discarded. Use `each` instead, or output the result with `<%= %>`.')

    assertOffenses(html)
  })

  it("flags flat_map", () => {
    const html = dedent`
      <% @groups.flat_map do |group| %>
        <p><%= group.name %></p>
      <% end %>
    `

    expectError('`flat_map` builds a new collection that is then discarded. Use `each` instead, or output the result with `<%= %>`.')

    assertOffenses(html)
  })

  it("flags filter_map", () => {
    const html = dedent`
      <% @users.filter_map do |user| %>
        <p><%= user.name %></p>
      <% end %>
    `

    expectError('`filter_map` builds a new collection that is then discarded. Use `each` instead, or output the result with `<%= %>`.')

    assertOffenses(html)
  })

  it("does not flag each", () => {
    expectNoOffenses(dedent`
      <% @users.each do |user| %>
        <p><%= user.name %></p>
      <% end %>
    `)
  })

  it("does not flag each_with_index", () => {
    expectNoOffenses(dedent`
      <% @users.each_with_index do |user, index| %>
        <p><%= index %></p>
      <% end %>
    `)
  })

  it("does not flag times", () => {
    expectNoOffenses(dedent`
      <% 3.times do |index| %>
        <p><%= index %></p>
      <% end %>
    `)
  })

  it("does not flag an output map block", () => {
    expectNoOffenses(dedent`
      <%= @users.map do |user| %>
        <p><%= user.name %></p>
      <% end %>
    `)
  })

  it("does not flag a map result assigned to a variable", () => {
    expectNoOffenses(dedent`
      <% names = @users.map do |user| %>
        <%= user.name %>
      <% end %>
    `)
  })

  it("does not flag an inline map that is output", () => {
    expectNoOffenses(dedent`
      <%= @users.map(&:name).join(", ") %>
    `)
  })

  it("does not flag a builder block", () => {
    expectNoOffenses(dedent`
      <%= form_with model: @user do |form| %>
        <%= form.text_field :name %>
      <% end %>
    `)
  })

  it("flags a map block nested inside an each block", () => {
    const html = dedent`
      <% @groups.each do |group| %>
        <% group.users.map do |user| %>
          <p><%= user.name %></p>
        <% end %>
      <% end %>
    `

    expectError('`map` builds a new collection that is then discarded. Use `each` instead, or output the result with `<%= %>`.')

    assertOffenses(html)
  })

  it("flags each discarded block separately", () => {
    const html = dedent`
      <% @users.map do |user| %>
        <p><%= user.name %></p>
      <% end %>

      <% @groups.select do |group| %>
        <p><%= group.name %></p>
      <% end %>
    `

    expectError('`map` builds a new collection that is then discarded. Use `each` instead, or output the result with `<%= %>`.')
    expectError('`select` builds a new collection that is then discarded. Use `each` instead, or output the result with `<%= %>`.')

    assertOffenses(html)
  })
})
