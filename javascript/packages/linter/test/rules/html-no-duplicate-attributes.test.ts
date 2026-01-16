import dedent from "dedent"
import { describe, test } from "vitest"
import { HTMLNoDuplicateAttributesRule } from "../../src/rules/html-no-duplicate-attributes.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(HTMLNoDuplicateAttributesRule)

describe("html-no-duplicate-attributes", () => {
  test("passes for unique attributes", () => {
    expectNoOffenses(`<input type="text" name="username" id="user-id">`)
  })

  test("fails for duplicate attributes", () => {
    expectError("Duplicate attribute `type`. Browsers only use the first occurrence and ignore duplicate attributes. Remove the duplicate or merge the values.")
    assertOffenses(`<input type="text" type="password" name="username">`)
  })

  test("fails for multiple duplicate attributes", () => {
    expectError("Duplicate attribute `type`. Browsers only use the first occurrence and ignore duplicate attributes. Remove the duplicate or merge the values.")
    expectError("Duplicate attribute `class`. Browsers only use the first occurrence and ignore duplicate attributes. Remove the duplicate or merge the values.")
    assertOffenses(`<button type="submit" type="button" class="btn" class="primary"></button>`)
  })

  test("handles case-insensitive duplicates", () => {
    expectError("Duplicate attribute `class`. Browsers only use the first occurrence and ignore duplicate attributes. Remove the duplicate or merge the values.")
    assertOffenses(`<div Class="container" class="active"></div>`)
  })

  test("passes for different attributes", () => {
    expectNoOffenses(`<div class="container" id="main" data-value="test"></div>`)
  })

  test("handles self-closing tags", () => {
    expectError("Duplicate attribute `src`. Browsers only use the first occurrence and ignore duplicate attributes. Remove the duplicate or merge the values.")
    assertOffenses(`<img src="/logo.png" src="/backup.png" alt="Logo">`)
  })

  test("handles ERB templates with attributes", () => {
    expectNoOffenses(`<div class="<%= classes %>" data-id="<%= item.id %>"></div>`)
  })

  test("ignores closing tags", () => {
    expectNoOffenses(`<div class="test"></div>`)
  })

  test("passes when ERB control flow uses unique attributes", () => {
    expectNoOffenses(dedent`
      <div
        <% if active? %>
          class="active"
        <% else %>
          class="inactive"
        <% end %>
      ></div>
    `)
  })

  test("fails when ERB control flow adds duplicate attributes on the same tag", () => {
    expectError("Duplicate attribute `class`. Browsers only use the first occurrence and ignore duplicate attributes. Remove the duplicate or merge the values.")
    assertOffenses(dedent`
      <div
        class="base"

        <% if active? %>
          class="active"
        <% end %>
      ></div>
    `)
  })

  test("fails when attribute outside control flow and different branches create duplicates", () => {
    expectError("Duplicate attribute `class`. Browsers only use the first occurrence and ignore duplicate attributes. Remove the duplicate or merge the values.")
    expectError("Duplicate attribute `class`. Browsers only use the first occurrence and ignore duplicate attributes. Remove the duplicate or merge the values.")
    assertOffenses(dedent`
      <div
        class="base"

        <% if active? %>
          class="active"
        <% else %>
          class="inactive"
        <% end %>
      ></div>
    `)
  })

  test("fails for duplicate attributes within the same control flow branch", () => {
    expectError("Duplicate attribute `class` in same branch. This branch will produce an element with duplicate attributes. Remove one or merge the values.")
    assertOffenses(dedent`
      <div
        <% if condition %>
          class="one"
          class="two"
        <% end %>
      ></div>
    `)
  })

  test("fails for duplicate attributes within the same loop iteration", () => {
    expectError("Attribute `class` inside loop will appear multiple times on this element. Use a dynamic attribute name like `class-<%= index %>` or move the attribute outside the loop.")
    expectError("Duplicate attribute `class` in same loop iteration. Each iteration will produce an element with duplicate attributes. Remove one or merge the values.")

    assertOffenses(dedent`
      <div
        <% while condition %>
          class="one"
          class="two"
        <% end %>
      ></div>
    `)
  })

  test("fails for duplicate attributes with attribute outside control flow and mutually exclusive case/when branches", () => {
    expectError("Duplicate attribute `class`. Browsers only use the first occurrence and ignore duplicate attributes. Remove the duplicate or merge the values.")
    expectError("Duplicate attribute `class`. Browsers only use the first occurrence and ignore duplicate attributes. Remove the duplicate or merge the values.")
    expectError("Duplicate attribute `class`. Browsers only use the first occurrence and ignore duplicate attributes. Remove the duplicate or merge the values.")
    assertOffenses(dedent`
      <div
        class="base"

        <% case status %>
        <% when 'active' %>
          class="status-active"
        <% when 'inactive' %>
          class="status-inactive"
        <% else %>
          class="status-other"
        <% end %>
      ></div>
    `)
  })

  test("fails when attribute appears after control flow that contained same attribute", () => {
    expectError("Duplicate attribute `class`. Browsers only use the first occurrence and ignore duplicate attributes. Remove the duplicate or merge the values.")

    assertOffenses(dedent`
      <div
        <% if active? %>
          class="active"
        <% end %>
        class="base"
      ></div>
    `)
  })

  test("fails when attribute appears after if/else control flow", () => {
    expectError("Duplicate attribute `class`. Browsers only use the first occurrence and ignore duplicate attributes. Remove the duplicate or merge the values.")

    assertOffenses(dedent`
      <div
        <% if active? %>
          class="active"
        <% else %>
          class="inactive"
        <% end %>
        class="base"
      ></div>
    `)
  })

  test("passes for different attributes in control flow branches", () => {
    expectNoOffenses(dedent`
      <div
        <% if active? %>
          class="active"
        <% else %>
          id="inactive"
        <% end %>
      ></div>
    `)
  })

  test("fails for nested control flow with duplicate in inner branch", () => {
    expectError("Duplicate attribute `class` in same branch. This branch will produce an element with duplicate attributes. Remove one or merge the values.")

    assertOffenses(dedent`
      <div
        <% if outer %>
          <% if inner %>
            class="one"
            class="two"
          <% end %>
        <% end %>
      ></div>
    `)
  })

  test("fails when outer attribute conflicts with nested control flow attribute", () => {
    expectError("Duplicate attribute `class`. Browsers only use the first occurrence and ignore duplicate attributes. Remove the duplicate or merge the values.")

    assertOffenses(dedent`
      <div
        class="base"
        <% if outer %>
          <% if inner %>
            class="nested"
          <% end %>
        <% end %>
      ></div>
    `)
  })

  test("passes for unless control flow with unique attributes per branch", () => {
    expectNoOffenses(dedent`
      <div
        <% unless disabled? %>
          class="enabled"
        <% else %>
          class="disabled"
        <% end %>
      ></div>
    `)
  })

  test("fails for for loop with duplicate attributes", () => {
    expectError("Attribute `data-index` inside loop will appear multiple times on this element. Use a dynamic attribute name like `data-index-<%= index %>` or move the attribute outside the loop.")
    expectError("Duplicate attribute `data-index` in same loop iteration. Each iteration will produce an element with duplicate attributes. Remove one or merge the values.")

    assertOffenses(dedent`
      <div
        <% for item in @items %>
          data-index="1"
          data-index="2"
        <% end %>
      ></div>
    `)
  })

  test("fails for static attribute name in loop", () => {
    expectError("Attribute `data-id` inside loop will appear multiple times on this element. Use a dynamic attribute name like `data-id-<%= index %>` or move the attribute outside the loop.")

    assertOffenses(dedent`
      <div
        <% for item in @items %>
          data-id="<%= item.id %>"
        <% end %>
      ></div>
    `)
  })

  test("passes for dynamic attribute name in loop", () => {
    expectNoOffenses(dedent`
      <div
        <% @items.each_with_index do |item, i| %>
          data-id-<%= i %>="value"
        <% end %>
      ></div>
    `)
  })

  test.fails("fails for static attribute name in each loop", () => {
    assertOffenses(dedent`
      <div
        <% @items.each do |i| %>
          data-id="<%= i %>"
        <% end %>
      ></div>
    `)
  })

  test.fails("fails for static attribute name in each_with_index loop", () => {
    assertOffenses(dedent`
      <div
        <% @items.each_with_index do |item, i| %>
          data-id="<%= i %>"
        <% end %>
      ></div>
    `)
  })

  test.fails("fails for static attribute name in times loop", () => {
    assertOffenses(dedent`
      <div
        <% 10.times do |i| %>
          data-id="<%= i %>"
        <% end %>
      ></div>
    `)
  })

  test("fails when attribute before loop conflicts with attribute inside loop", () => {
    expectError("Duplicate attribute `class`. Browsers only use the first occurrence and ignore duplicate attributes. Remove the duplicate or merge the values.")

    assertOffenses(dedent`
      <div
        class="base"

        <% @items.each do |item| %>
          class="item"
        <% end %>
      ></div>
    `)
  })
})
