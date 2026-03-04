import dedent from "dedent"
import { describe, test } from "vitest"
import { HTMLNoDuplicateIdsRule } from "../../src/rules/html-no-duplicate-ids.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(HTMLNoDuplicateIdsRule)

describe("html-no-duplicate-ids", () => {
  test("passes for unique IDs", () => {
    expectNoOffenses(`<div id="unique1"></div><span id="unique2"></span>`)
  })

  test("fails for duplicate IDs", () => {
    expectError('Duplicate ID `duplicate` found. IDs must be unique within a document.')
    assertOffenses(`<div id="duplicate"></div><span id="duplicate"></span>`)
  })

  test("passes for missing IDs", () => {
    expectNoOffenses(`<div></div><span></span>`)
  })

  test("passes for IDs without value", () => {
    expectNoOffenses(`<div id=""></div><span id="  "></span>`)
  })

  test("passes for other attributes with equal value", () => {
    expectNoOffenses(`<div class="value"></div><div class="value"></div>`)
  })

  test("passes when using ERB in ID", () => {
    expectNoOffenses(`<div id="<%= user.id %>"></div>`)
  })

  // TODO: this should also warn if it's in the same "context"
  test.todo("fails for multiple duplicate IDs in ERB in the same context", () => {
    expectError('Duplicate ID `<%= user.id %>` found. IDs must be unique within a document.')
    assertOffenses(`<div id="<%= user.id %>"></div><span id="<%= user.id %>"></span>`)
  })

  test("passes for IDs in mutually exclusive if/else branches", () => {
    expectNoOffenses(dedent`
      <% if some_condition? %>
        <span id="my-id">content1</span>
      <% else %>
        <span id="my-id">content2</span>
      <% end %>
    `)
  })

  test("passes for IDs in mutually exclusive unless/else branches", () => {
    expectNoOffenses(dedent`
      <% unless some_condition? %>
        <span id="my-id">content1</span>
      <% else %>
        <span id="my-id">content2</span>
      <% end %>
    `)
  })

  test("fails for IDs in mutually exclusive unless/else branches and global", () => {
    expectError('Duplicate ID `my-id` found. IDs must be unique within a document.')
    expectError('Duplicate ID `my-id` found. IDs must be unique within a document.')
    assertOffenses(dedent`
      <span id="my-id">content</span>

      <% unless some_condition? %>
        <span id="my-id">content1</span>
      <% else %>
        <span id="my-id">content2</span>
      <% end %>
    `)
  })

  test("passes for IDs in mutually exclusive case/when branches", () => {
    expectNoOffenses(dedent`
      <% case status %>
      <% when 'active' %>
        <div id="status-indicator">Active</div>
      <% when 'inactive' %>
        <div id="status-indicator">Inactive</div>
      <% else %>
        <div id="status-indicator">Unknown</div>
      <% end %>
    `)
  })

  test("fails for IDs in mutually exclusive case/when branches and global", () => {
    expectError('Duplicate ID `status-indicator` found. IDs must be unique within a document.')
    expectError('Duplicate ID `status-indicator` found. IDs must be unique within a document.')
    expectError('Duplicate ID `status-indicator` found. IDs must be unique within a document.')
    assertOffenses(dedent`
      <div id="status-indicator">Active</div>

      <% case status %>
      <% when 'active' %>
        <div id="status-indicator">Active</div>
      <% when 'inactive' %>
        <div id="status-indicator">Inactive</div>
      <% else %>
        <div id="status-indicator">Unknown</div>
      <% end %>
    `)
  })

  test("fails for duplicate IDs within same control flow branch", () => {
    expectError('Duplicate ID `duplicate-in-branch` found within the same control flow branch. IDs must be unique within the same control flow branch.')
    assertOffenses(dedent`
      <% if some_condition? %>
        <span id="duplicate-in-branch">content1</span>
        <span id="duplicate-in-branch">content2</span>
      <% end %>
    `)
  })

  test("fails for IDs duplicated outside of control flow", () => {
    expectError('Duplicate ID `global-duplicate` found. IDs must be unique within a document.')
    assertOffenses(dedent`
      <div id="global-duplicate">outside</div>

      <% if some_condition? %>
        <span id="different-id">inside branch</span>
      <% end %>

      <div id="global-duplicate">outside again</div>
    `)
  })

  test("fails for IDs duplicated outside before control flow", () => {
    expectError('Duplicate ID `global-duplicate` found. IDs must be unique within a document.')
    assertOffenses(dedent`
      <div id="global-duplicate">outside</div>

      <% if some_condition? %>
        <span id="global-duplicate">inside branch</span>
      <% end %>
    `)
  })

  test("fails for IDs duplicated outside after control flow", () => {
    expectError('Duplicate ID `global-duplicate` found. IDs must be unique within a document.')
    assertOffenses(dedent`
      <% if some_condition? %>
        <span id="global-duplicate">inside branch</span>
      <% end %>

      <div id="global-duplicate">outside</div>
    `)
  })

  test("fails for IDs duplicated outside after control flow", () => {
    expectError('Duplicate ID `global-duplicate` found. IDs must be unique within a document.')
    assertOffenses(dedent`
      <% if some_condition? %>
        <!-- empty -->
      <% elsif another_condition? %>
        <!-- empty -->
      <% else %>
        <span id="global-duplicate">inside branch</span>
      <% end %>

      <div id="global-duplicate">outside</div>
    `)
  })

  test("fails for IDs duplicated outside after control flow", () => {
    expectError('Duplicate ID `global-duplicate` found. IDs must be unique within a document.')
    assertOffenses(dedent`
      <% if some_condition? %>
        <!-- empty -->
      <% elsif other_condition? %>
        <span id="global-duplicate">inside branch</span>
      <% end %>

      <div id="global-duplicate">outside</div>
    `)
  })

  test("passes for IDs duplicated in elsif and else", () => {
    expectNoOffenses(dedent`
      <% if some_condition? %>
        <!-- empty -->
      <% elsif other_condition? %>
        <span id="global-duplicate">inside branch</span>
      <% else other_condition? %>
        <span id="global-duplicate">inside branch</span>
      <% end %>
    `)
  })

  test("handles nested control flow properly", () => {
    expectNoOffenses(dedent`
      <% if outer_condition? %>
        <% if inner_condition? %>
          <div id="nested-id">inner true</div>
        <% else %>
          <div id="nested-id">inner false</div>
        <% end %>
      <% else %>
        <div id="nested-id">outer false</div>
      <% end %>
    `)
  })

  test("passes for ID tag.div (ERBBlockNode)", () => {
    expectNoOffenses(dedent`
      <% tag.div do %>
        <div id="user">User</div>
      <% end %>
    `)
  })

  test("passes for output ERB IDs in loops (unique per iteration)", () => {
    expectError('Duplicate ID `user-<%= user.id %>` found. IDs must be unique within a document.')
    assertOffenses(dedent`
      <% users.each do |user| %>
        <div id="user-<%= user.id %>">User</div>
      <% end %>

      <% users.each do |user| %>
        <div id="user-<%= user.id %>">User again</div>
      <% end %>
    `)
  })

  test("fails for non-output ERB IDs in loops (same value repeated)", () => {
    expectError('Duplicate ID `user-` found within the same control flow branch. IDs must be unique within the same control flow branch.')
    assertOffenses(dedent`
      <% users.each do |user| %>
        <div id="user-<% 'static' %>">User</div>
        <div id="user-<% 'static' %>">Duplicate</div>
      <% end %>
    `)
  })

  test("passes for output ERB IDs in while loops", () => {
    expectNoOffenses(dedent`
      <% counter = 0 %>
      <% count = 0 %>

      <% while condition %>
        <div id="item-<%= counter %>">Item</div>
        <div id="item-<%= count %>">Item</div>
        <div id="post-<%= counter %>">Post</div>
        <% counter += 1 %>
      <% end %>
    `)
  })

  test("fails for static ID in while loops", () => {
    expectError('Duplicate ID `static-id` found. IDs must be unique within a document.')
    assertOffenses(dedent`
      <% while condition %>
        <div id="static-id">Item</div>
      <% end %>
    `)
  })

  test("fails for non-dynamic ID in until loops", () => {
    expectError('Duplicate ID `static-id` found. IDs must be unique within a document.')
    assertOffenses(dedent`
      <% until condition %>
        <div id="static-id">Item</div>
      <% end %>
    `)
  })

  test("handles output ERB IDs in conditional flow normally", () => {
    expectNoOffenses(dedent`
      <% if condition %>
        <div id="user-<%= user.id %>">User A</div>
      <% else %>
        <div id="user-<%= user.id %>">User B</div>
      <% end %>
    `)
  })

  test("fails for duplicate output ERB IDs within same conditional branch", () => {
    expectError('Duplicate ID `user-<%= user.id %>` found within the same control flow branch. IDs must be unique within the same control flow branch.')
    assertOffenses(dedent`
      <% if condition %>
        <div id="user-<%= user.id %>">User A</div>
        <div id="user-<%= user.id %>">User A duplicate</div>
      <% end %>
    `)
  })

  test("passes for static ID conflicting with dynamic ID prefix", () => {
    expectNoOffenses(dedent`
      <div id="hello">Static</div>
      <div id="hello<%= suffix %>">Dynamic</div>
    `)
  })

  test("passes for dynamic ID conflicting with existing static ID", () => {
    expectNoOffenses(dedent`
      <div id="hello<%= suffix %>">Dynamic</div>
      <div id="hello">Static</div>
    `)
  })

  test("passes for non-conflicting static and dynamic IDs", () => {
    expectNoOffenses(dedent`
      <div id="hello">Static</div>
      <div id="goodbye<%= suffix %>">Dynamic</div>
    `)
  })

  test.todo("fails for static attribute in a loop context", () => {
    expectError('Duplicate ID `user` found. IDs must be unique within a document.')
    assertOffenses(dedent`
      <% @users.each do |user| %>
        <div id="user"></div>
      <% end %>
    `)
  })

  test("passes for dynamic attribute in a ERBBlockNode each context", () => {
    expectNoOffenses(dedent`
      <% @users.each do |user| %>
        <div id="<%= user.id %>"></div>
      <% end %>
    `)
  })
})
