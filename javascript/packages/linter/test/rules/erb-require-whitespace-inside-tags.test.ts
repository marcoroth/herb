import { describe, it } from "vitest"
import dedent from "dedent";

import { ERBRequireWhitespaceRule } from "../../src/rules/erb-require-whitespace-inside-tags";
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(ERBRequireWhitespaceRule)

describe("erb-require-whitespace-inside-tags", () => {

  it("should not report for correct whitespace in ERB tags", () => {
    const html = dedent`
      <% if admin %>
        Hello, admin.
      <% end %>
    `

    expectNoOffenses(html)
  })

  it("should require a space after <% and before %> in ERB tags", () => {
    const html = dedent`
      <%if true%>
      <% end %>
    `

    expectError("Add whitespace after `<%`.")
    expectError("Add whitespace before `%>`.")
    assertOffenses(html)
  })

  it("should require a space after <%= and before %> in ERB output tags", () => {
    const html = dedent`
      <%=user.name%>
      <%= user.name %>
    `

    expectError("Add whitespace after `<%=`.")
    expectError("Add whitespace before `%>`.")
    assertOffenses(html)
  })

  it("should report errors for only missing opening whitespace", () => {
    const html = dedent`
      <%if user %>
        Hello, user.
      <% end %>
    `

    expectError("Add whitespace after `<%`.")
    assertOffenses(html)
  })

  it("should report errors for only missing closing whitespace", () => {
    const html = dedent`
      <% if admin%>
        Hello, admin.
      <% end %>
    `

    expectError("Add whitespace before `%>`.")
    assertOffenses(html)
  })

  it("should report multiple errors for multiple offenses", () => {
    const html = dedent`
      <%=user.name%>
      <%if admin%>
        Hello, admin.
      <%end%>
    `

    expectError("Add whitespace after `<%=`.")
    expectError("Add whitespace before `%>`.")
    expectError("Add whitespace after `<%`.")
    expectError("Add whitespace before `%>`.")
    expectError("Add whitespace after `<%`.")
    expectError("Add whitespace before `%>`.")
    assertOffenses(html)
  })

  it("should not report for non-ERB content", () => {
    const html = dedent`
      <div>Hello</div>
      <p>World</p>
    `

    expectNoOffenses(html)
  })

  it("should handle mixed correct and incorrect ERB tags", () => {
    const html = dedent`
      <%= user.name %>
      <%=user.email%>
      <% if admin %>
        <h1>Hello, admin.</h1>
      <%end%>
    `

    expectError("Add whitespace after `<%=`.")
    expectError("Add whitespace before `%>`.")
    expectError("Add whitespace after `<%`.")
    expectError("Add whitespace before `%>`.")
    assertOffenses(html)
  })

  it("should handle empty erb tags", () => {
    const html = dedent`
      <% %>
      <%= %>
      <% if true %> <% end %>
      <%

      %>
    `

    expectNoOffenses(html)
  })

  it("should require whitespace after # in ERB comment tags", () => {
    const html = dedent`
      <%# This is a comment %>
      <%#This is a comment without spaces%>
      <%# %>
    `

    expectError("Add whitespace after `<%#`.")
    expectError("Add whitespace before `%>`.")
    assertOffenses(html)
  })

  it("should not report ERB comment tags with equals signs", () => {
    const html = dedent`
      <%#= link_to "New watch list", new_watch_list_path, class: "btn btn-ghost" %>
    `

    expectNoOffenses(html)
  })

  it("should report ERB comment tags with equals sign and no space after", () => {
    const html = dedent`
      <%#=link_to "New watch list", new_watch_list_path, class: "btn btn-ghost"%>
    `

    expectError("Add whitespace after `<%#=`.")
    expectError("Add whitespace before `%>`.")
    assertOffenses(html)
  })

  it("should not report ERB comment tags with equals followed by space", () => {
    const html = dedent`
      <%# = link_to "New watch list", new_watch_list_path, class: "btn btn-ghost" %>
    `

    expectNoOffenses(html)
  })

  it("should handle multi-line ERB comment tags", () => {
    const html = dedent`
      <%#
        This is a multi-line comment
        with multiple lines
      %>

      <%#=
        link_to "New watch list",
        new_watch_list_path,
        class: "btn btn-ghost"
      %>
    `

    expectNoOffenses(html)
  })
})
