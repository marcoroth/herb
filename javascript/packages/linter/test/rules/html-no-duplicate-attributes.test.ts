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
    expectError('Duplicate attribute `type` found on tag. Remove the duplicate occurrence.')
    assertOffenses(`<input type="text" type="password" name="username">`)
  })

  test("fails for multiple duplicate attributes", () => {
    expectError('Duplicate attribute `type` found on tag. Remove the duplicate occurrence.')
    expectError('Duplicate attribute `class` found on tag. Remove the duplicate occurrence.')
    assertOffenses(`<button type="submit" type="button" class="btn" class="primary"></button>`)
  })

  test("handles case-insensitive duplicates", () => {
    expectError('Duplicate attribute `class` found on tag. Remove the duplicate occurrence.')
    assertOffenses(`<div Class="container" class="active"></div>`)
  })

  test("passes for different attributes", () => {
    expectNoOffenses(`<div class="container" id="main" data-value="test"></div>`)
  })

  test("handles self-closing tags", () => {
    expectError('Duplicate attribute `src` found on tag. Remove the duplicate occurrence.')
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
    expectError("Duplicate attribute `class` found on tag. Remove the duplicate occurrence.")
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
    expectError("Duplicate attribute `class` found on tag. Remove the duplicate occurrence.")
    expectError("Duplicate attribute `class` found on tag. Remove the duplicate occurrence.")
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
    expectError(
      "Duplicate attribute `class` found within the same control flow branch. Attributes must be unique within the same control flow branch.",
    )
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
    expectError(
      "Duplicate attribute `class` found within the same loop iteration. Attributes must be unique within the same loop iteration.",
    )
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
    expectError("Duplicate attribute `class` found on tag. Remove the duplicate occurrence.")
    expectError("Duplicate attribute `class` found on tag. Remove the duplicate occurrence.")
    expectError("Duplicate attribute `class` found on tag. Remove the duplicate occurrence.")
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
})
