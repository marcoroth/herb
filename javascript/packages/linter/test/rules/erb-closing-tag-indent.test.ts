import dedent from "dedent"
import { describe, test } from "vitest"
import { ERBClosingTagIndentRule } from "../../src/rules/erb-closing-tag-indent.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(ERBClosingTagIndentRule)

describe("ERBClosingTagIndentRule", () => {
  test("ignores on empty ERB tag", () => {
    expectNoOffenses(dedent`<% %>`)
  })

  test("ignores single-line ERB output tag", () => {
    expectNoOffenses(dedent`<%= title %>`)
  })

  test("passes on single-line ERB with matching end statement", () => {
    expectNoOffenses(dedent`
      <% if admin? %>
        <h1>Content</h1>
      <% end %>
    `)
  })

  test("passes on multi-line ERB with matching indent", () => {
    expectNoOffenses(dedent`
      <%=
        some_helper(
          arg1,
          arg2
        )
      %>
    `)
  })

  test("passes on multi-line ERB at beginning of line", () => {
    expectNoOffenses(dedent`<%=
title
%>`)
  })

  describe("missing newline before closing tag", () => {
    test("handles closing tag not followed by matching newline", () => {
      expectError("Add newline before `%>`. The opening `<%=` is followed by a newline, so the closing tag should be on its own line.")

      assertOffenses(dedent`
        <%=
          title %>
      `)
    })
  })

  describe("superfluous newline before closing tag", () => {
    test("handles closing tag followed by additional newline", () => {
      expectError("Remove newline before `%>`. The opening `<%=` is not followed by a newline, so the closing tag should be on the same line.")

      assertOffenses(dedent`
        <%= title
        %>
      `)
    })
  })

  describe("incorrect indentation", () => {
    test("handles closing tag indented more than opening tag", () => {
      expectError("Incorrect indentation for `%>`. Expected 0 spaces but found 2.")

      assertOffenses("<%=\n  title\n  %>")
    })

    test("handles closing tag indented less than opening tag", () => {
      expectError("Incorrect indentation for `%>`. Expected 2 spaces but found 0.")

      assertOffenses("  <%=\n    title\n%>")
    })

    test("handles mismatched indent on closing tag", () => {
      expectError("Incorrect indentation for `%>`. Expected 4 spaces but found 2.")

      assertOffenses("    <%=\n      title\n  %>")
    })
  })
})
