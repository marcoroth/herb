import { describe, it } from "vitest"
import dedent from "dedent";

import { ERBNoExtraWhitespaceRule } from "../../src/rules/erb-no-extra-whitespace-inside-tags";
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(ERBNoExtraWhitespaceRule)

describe("erb-no-extra-whitespace-inside-tags", () => {
  it("should not report for correct single whitespace in ERB tags", () => {
    expectNoOffenses(dedent`
      <% if admin %>
        Hello, admin.
      <% end %>
    `)
  })

  it("should not report for correct ERB output tags with single space", () => {
    expectNoOffenses(dedent`
      <%= user.name %>
      <%= user.email %>
    `)
  })

  it("should report extra whitespace after <% opening tag", () => {
    expectError("Remove extra whitespace after `<%`.", [1, 2])

    assertOffenses(dedent`
      <%  if true %>
      <% end %>
    `)
  })

  it("should report extra whitespace before %> closing tag", () => {
    expectError("Remove extra whitespace before `%>`.", [1, 11])

    assertOffenses(dedent`
      <% if admin  %>
        Hello, admin.
      <% end %>
    `)
  })

  it("should report extra whitespace in ERB output tags after opening", () => {
    expectError("Remove extra whitespace after `<%=`.", [1, 3])

    assertOffenses(dedent`
      <%=  user.name %>
      <%= user.name %>
    `)
  })

  it("should report extra whitespace in ERB output tags before closing", () => {
    expectError("Remove extra whitespace before `%>`.", [1, 13])

    assertOffenses(dedent`
      <%= user.name  %>
      <%= user.email %>
    `)
  })

  it("should report both extra opening and closing whitespace", () => {
    expectError("Remove extra whitespace after `<%=`.", [1, 3])
    expectError("Remove extra whitespace before `%>`.", [1, 14])

    assertOffenses(`<%=  user.name  %>`)
  })

  it("should report multiple errors for multiple offenses", () => {
    expectError("Remove extra whitespace after `<%=`.", [1, 3])
    expectError("Remove extra whitespace before `%>`.", [1, 14])
    expectError("Remove extra whitespace after `<%`.", [2, 2])
    expectError("Remove extra whitespace before `%>`.", [2, 12])
    expectError("Remove extra whitespace after `<%`.", [4, 2])
    expectError("Remove extra whitespace before `%>`.", [4, 7])

    assertOffenses(dedent`
      <%=  user.name  %>
      <%  if admin  %>
        Hello, admin.
      <%  end  %>
    `)
  })

  it("should not report for non-ERB content", () => {
    expectNoOffenses(dedent`
      <div>  Hello  </div>
      <p>  World  </p>
    `)
  })

  it("should handle mixed correct and incorrect ERB tags", () => {
    expectError("Remove extra whitespace after `<%=`.", [2, 3])
    expectError("Remove extra whitespace before `%>`.", [2, 15])
    expectError("Remove extra whitespace after `<%`.", [5, 2])
    expectError("Remove extra whitespace before `%>`.", [5, 7])

    assertOffenses(dedent`
      <%= user.name %>
      <%=  user.email  %>
      <% if admin %>
        <h1>Hello, admin.</h1>
      <%  end  %>
    `)
  })

  it("should handle ERB comment tags with extra whitespace", () => {
    expectError("Remove extra whitespace after `<%#`.", [2, 3])
    expectError("Remove extra whitespace before `%>`.", [2, 40])

    assertOffenses(dedent`
      <%# This is a comment %>
      <%#  This is a comment with extra spaces  %>
      <%# %>
    `)
  })

  it("should report ERB comment tags with equals sign and extra whitespace", () => {
    expectError("Remove extra whitespace after `<%#=`.", [1, 4])
    expectError("Remove extra whitespace before `%>`.", [1, 75])

    assertOffenses(dedent`
      <%#=  link_to "New watch list", new_watch_list_path, class: "btn btn-ghost"  %>
    `)
  })

  it("should not report ERB comment tags with single space after equals", () => {
    expectNoOffenses(dedent`
      <%#= link_to "New watch list", new_watch_list_path, class: "btn btn-ghost" %>
    `)
  })

  it("should handle multi-line ERB tags with proper spacing", () => {
    expectNoOffenses(dedent`
      <%
        if condition
          something
        end
      %>
    `)
  })

  it("should report only tags with multiple consecutive spaces", () => {
    expectError("Remove extra whitespace after `<%`.", [4, 2])
    expectError("Remove extra whitespace after `<%=`.", [8, 3])

    assertOffenses(dedent`
      <% if true %>
        Valid
      <% end %>
      <%  if false %>
        Invalid
      <% end %>
      <%= output %>
      <%=   another %>
    `)
  })

  it("should handle ERB tags with three or more spaces", () => {
    expectError("Remove extra whitespace after `<%`.", [1, 2])
    expectError("Remove extra whitespace before `%>`.", [1, 14])

    assertOffenses(dedent`
      <%    if admin    %>
        Hello
      <% end %>
    `)
  })

  it("should not report empty ERB tags with single spaces", () => {
    expectNoOffenses(dedent`
      <% %>
      <%= %>
    `)
  })

  it("should handle ERB tags with tabs and spaces", () => {
    expectError("Remove extra whitespace after `<%`.", [1, 2])

    assertOffenses(dedent`
      <%  	if true %>
        Hello
      <% end %>
    `)
  })

  it("doesn't report multi-line whitespace", () => {
    expectNoOffenses(dedent`
      <h3>
        <%= render partial: "posts/post",
                   locals: {},
                   as: :post
        %>
      </h3>
    `)
  })

  it("reports leading double space in multi-line tag", () => {
    expectError("Remove extra whitespace after `<%=`.", [2, 5])

    assertOffenses(dedent`
      <h3>
        <%=  render partial: "posts/post",
                    locals: {},
                    as: :post
        %>
      </h3>
    `)
  })

  it("doesn't report with tailing newline in multi-line tag", () => {
    expectNoOffenses(dedent`
      <h3>
        <%=
          render partial: "posts/post",
                 locals: {},
                 as: :post
        %>
      </h3>
    `)
  })
})
