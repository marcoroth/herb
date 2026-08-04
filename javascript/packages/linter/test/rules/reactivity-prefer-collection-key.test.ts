import { describe, test } from "vitest"
import dedent from "dedent"

import { ReactivityPreferCollectionKeyRule } from "../../src/rules/reactivity-prefer-collection-key.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectWarning, assertOffenses } = createLinterTest(ReactivityPreferCollectionKeyRule)

describe("reactivity-prefer-collection-key", () => {
  test("fails for a collection row without a key", () => {
    expectWarning("Add a `herb-key` or `id` attribute to `<li>` so rows can be matched across updates. Without a key, inserting or reordering the collection re-renders every following row and discards its focus, scroll, and input state.")

    assertOffenses(dedent`
      <% @users.each do |user| %>
        <li><%= user.name %></li>
      <% end %>
    `)
  })

  test("fails for a map block", () => {
    expectWarning("Add a `herb-key` or `id` attribute to `<div>` so rows can be matched across updates. Without a key, inserting or reordering the collection re-renders every following row and discards its focus, scroll, and input state.")

    assertOffenses(dedent`
      <% @users.map do |user| %>
        <div><%= user.name %></div>
      <% end %>
    `)
  })

  test("fails for a nested collection while the outer one is keyed", () => {
    expectWarning("Add a `herb-key` or `id` attribute to `<td>` so rows can be matched across updates. Without a key, inserting or reordering the collection re-renders every following row and discards its focus, scroll, and input state.")

    assertOffenses(dedent`
      <% @rows.each do |row| %>
        <tr id="<%= dom_id(row) %>">
          <% row.cells.each do |cell| %>
            <td><%= cell %></td>
          <% end %>
        </tr>
      <% end %>
    `)
  })

  test("passes for an explicit herb-key", () => {
    expectNoOffenses(dedent`
      <% @users.each do |user| %>
        <li herb-key="<%= user.id %>"><%= user.name %></li>
      <% end %>
    `)
  })

  test("passes for an id, which Rails templates already carry for Turbo", () => {
    expectNoOffenses(dedent`
      <% @users.each do |user| %>
        <li id="<%= dom_id(user) %>"><%= user.name %></li>
      <% end %>
    `)
  })

  test("passes for a numeric loop, whose items are positions", () => {
    expectNoOffenses(dedent`
      <% 3.times do |index| %>
        <li><%= index %></li>
      <% end %>
    `)
  })

  test("passes for the other counting loops", () => {
    expectNoOffenses(dedent`
      <% 1.upto(3) do |index| %>
        <li><%= index %></li>
      <% end %>
    `)
  })

  test("fails for a body with more than one root, which needs the directive", () => {
    expectWarning("Add a `<%# herb:key ... %>` directive to this collection, or wrap each row in a single element with a `herb-key` or `id` attribute, so rows can be matched across updates. Without a key, inserting or reordering the collection re-renders every following row and discards its focus, scroll, and input state.")

    assertOffenses(dedent`
      <% @users.each do |user| %>
        <li><%= user.name %></li>
        <li><%= user.email %></li>
      <% end %>
    `)
  })

  test("fails for a body with no element at all", () => {
    expectWarning("Add a `<%# herb:key ... %>` directive to this collection, or wrap each row in a single element with a `herb-key` or `id` attribute, so rows can be matched across updates. Without a key, inserting or reordering the collection re-renders every following row and discards its focus, scroll, and input state.")

    assertOffenses(dedent`
      <% @users.each do |user| %>
        <%= user.name %>
      <% end %>
    `)
  })

  test("passes for a herb:key directive on a body with several roots", () => {
    expectNoOffenses(dedent`
      <% @users.each do |user| %>
        <%# herb:key user.id %>

        <li><%= user.name %></li>
        <li><%= user.email %></li>
      <% end %>
    `)
  })

  test("passes for a herb:key directive on a body with no element", () => {
    expectNoOffenses(dedent`
      <% @users.each do |user| %>
        <%# herb:key user.id %>

        <%= user.name %>
      <% end %>
    `)
  })

  test("passes for an iteration method the parser recognises but this rule does not name", () => {
    expectNoOffenses(dedent`
      <% @users.each_slice(2) do |pair| %>
        <li id="<%= dom_id(pair.first) %>"><%= pair.size %></li>
      <% end %>
    `)
  })
})
