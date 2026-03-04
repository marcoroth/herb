import dedent from "dedent"
import { describe, test } from "vitest"
import { ERBNoEmptyTagsRule } from "../../src/rules/erb-no-empty-tags.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(ERBNoEmptyTagsRule)

describe("ERBNoEmptyTagsRule", () => {
  test("should not report errors for valid ERB tags with content", () => {
    expectNoOffenses(dedent`
      <h1>
        <%= title %>
      </h1>

      <% if user.admin? %>
        Admin tools
      <% end %>

      <% user.posts.each do |post| %>
        <p><%= post.title %></p>
      <% end %>

      <%= "" %>
    `)
  })

  test("should not report errors for incomplete erb tags", () => {
    expectNoOffenses(dedent`
      <%
    `, { allowInvalidSyntax: true })
  })

  test("should not report errors for incomplete erb output tags", () => {
    expectNoOffenses(dedent`
      <%=
    `, { allowInvalidSyntax: true })
  })

  test("should report errors for completely empty ERB tags", () => {
    expectError("ERB tag should not be empty. Remove empty ERB tags or add content.", { line: 2, column: 2 })
    expectError("ERB tag should not be empty. Remove empty ERB tags or add content.", { line: 3, column: 2 })

    assertOffenses(dedent`
      <h1>
        <% %>
        <%= %>
      </h1>
    `)
  })

  test("should report errors for whitespace-only ERB tags", () => {
    expectError("ERB tag should not be empty. Remove empty ERB tags or add content.", { line: 2, column: 2 })
    expectError("ERB tag should not be empty. Remove empty ERB tags or add content.", { line: 3, column: 2 })
    expectError("ERB tag should not be empty. Remove empty ERB tags or add content.", { line: 4, column: 2 })

    assertOffenses(dedent`
      <h1>
        <%   %>
        <%=    %>
        <%
        %>
      </h1>
    `)
  })

  test("should not report errors for ERB tags with meaningful content", () => {
    expectNoOffenses(dedent`
      <div>
        <%= user.name %>
        <% if condition %>
        <% end %>
        <% # this is a comment %>
        <%= @variable %>
      </div>
    `)
  })

  test("should handle mixed valid and invalid ERB tags", () => {
    expectError("ERB tag should not be empty. Remove empty ERB tags or add content.", { line: 3, column: 2 })
    expectError("ERB tag should not be empty. Remove empty ERB tags or add content.", { line: 5, column: 2 })

    assertOffenses(dedent`
      <div>
        <%= user.name %>
        <% %>
        <% if condition %>
        <%= %>
        <% end %>
      </div>
    `)
  })

  test("should handle empty ERB tag in attribute value", () => {
    expectError("ERB tag should not be empty. Remove empty ERB tags or add content.", { line: 1, column: 12 })

    assertOffenses(`<div class="<%= %>"></div>`)
  })

  test("should handle empty ERB tag in open tag", () => {
    expectError("ERB tag should not be empty. Remove empty ERB tags or add content.", { line: 1, column: 5 })

    assertOffenses(`<div <%= %>></div>`)
  })
})
