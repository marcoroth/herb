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

  test("passes on multi-line ERB with the closing tag on the last line of code", () => {
    expectNoOffenses(dedent`
      <%= some_helper(
        arg1,
        arg2
      ) %>
    `)
  })

  test("passes on heredoc with matching indent", () => {
    expectNoOffenses(dedent`
      <%= render(<<~TEXT)
        hello
      TEXT
      %>
    `)
  })

  test("reports a misindented closing tag after a heredoc", () => {
    expectError("Indent `%>` to line up with the opening `<%=`. Expected 0 spaces but found 2.")

    assertOffenses(dedent`
      <%= render(<<~TEXT)
        hello
      TEXT
        %>
    `)
  })

  describe("whitespace trimming tags", () => {
    test("ignores a `<%-` opening tag", () => {
      expectNoOffenses("<%-\n  if admin?\n  %>\n  <h1>Content</h1>\n<% end %>")
    })

    test("ignores a `-%>` closing tag", () => {
      expectNoOffenses("<%\n  if admin?\n  -%>\n  <h1>Content</h1>\n<% end %>")
    })

    test("ignores a `=%>` closing tag", () => {
      expectNoOffenses("<%=\n  title\n  =%>")
    })
  })

  describe("ERB comments", () => {
    test("ignores a multi-line ERB comment", () => {
      expectNoOffenses("<%#\n  a note\n  %>")
    })

    test("ignores a block ERB comment closed with `-%>`", () => {
      expectNoOffenses(dedent`
        <%# Non-link tag that stands for skipped pages...
          - available local variables
            current_page:  a page object for the currently displayed page
            total_pages:   total number of pages
            per_page:      number of items to fetch per page
            remote:        data-remote
        -%>
      `)
    })
  })

  describe("Ruby comments", () => {
    test("ignores a tag holding only a comment", () => {
      expectNoOffenses('<%=\n# render_partial("_pagination")\n%>')
    })

    test("ignores a tag whose last line of code carries a comment", () => {
      expectNoOffenses("<%= title # the page title\n%>")
    })

    test("ignores a tag with a comment between statements", () => {
      expectNoOffenses("<%\n  # pick the current page\n  page = current_page\n  %>")
    })

    test("ignores a `=begin` block comment delimiter", () => {
      expectNoOffenses("<%\n=begin\n%>\n<p>Commented out</p>\n<%\n=end\n%>")
    })
  })

  describe("inside an HTML open tag", () => {
    test("ignores ERB in an attribute value", () => {
      expectNoOffenses(dedent`
        <li class="<%=
          class_names(
            "page-item",
            disabled: current_page.first?
          )
        %>">First</li>
      `)
    })

    test("ignores ERB between attributes", () => {
      expectNoOffenses("<div <%=\n  attributes\n%>>Content</div>")
    })
  })

  describe("single line of code split across lines", () => {
    test("handles a leading and a trailing newline", () => {
      expectError("Put the tag on one line as `<%= ... %>`. It holds a single line of Ruby, so the newlines inside it make it read as a multi-line block.")

      assertOffenses("<%=\n  title\n%>")
    })

    test("handles a leading newline only", () => {
      expectError("Put the tag on one line as `<%= ... %>`. It holds a single line of Ruby, so the newlines inside it make it read as a multi-line block.")

      assertOffenses("<%=\n  title %>")
    })

    test("handles a trailing newline only", () => {
      expectError("Put the tag on one line as `<%= ... %>`. It holds a single line of Ruby, so the newlines inside it make it read as a multi-line block.")

      assertOffenses("<%= title\n%>")
    })

    test("handles horizontal whitespace before the opening newline", () => {
      expectError("Put the tag on one line as `<%= ... %>`. It holds a single line of Ruby, so the newlines inside it make it read as a multi-line block.")

      assertOffenses("<%= \t\n  title\n%>")
    })

    test("handles a control-flow tag", () => {
      expectError("Put the tag on one line as `<% ... %>`. It holds a single line of Ruby, so the newlines inside it make it read as a multi-line block.")

      assertOffenses("<%\n  if admin?\n%>\n  <h1>Content</h1>\n<% end %>")
    })
  })

  describe("missing newline before closing tag", () => {
    test("handles closing tag not followed by matching newline", () => {
      expectError("Move `%>` onto its own line, lined up with the opening `<%=`. The opening tag stands on its own line, so a closing tag at the end of the code hides where the tag ends.")

      assertOffenses("<%=\n  some_helper(\n    arg1,\n    arg2\n  ) %>")
    })

    test("handles horizontal whitespace before the opening newline", () => {
      expectError("Move `%>` onto its own line, lined up with the opening `<%=`. The opening tag stands on its own line, so a closing tag at the end of the code hides where the tag ends.")

      assertOffenses("<%= \t\n  some_helper(\n    arg1,\n    arg2\n  ) %>")
    })
  })

  describe("superfluous newline before closing tag", () => {
    test("handles closing tag followed by additional newline", () => {
      expectError("Move `%>` up to the end of the last line of code. The opening `<%=` shares its line with code, so a closing tag alone on a line adds a line that carries nothing.")

      assertOffenses("<%= some_helper(\n  arg1,\n  arg2\n)\n%>")
    })
  })

  describe("incorrect indentation", () => {
    test("handles closing tag indented more than opening tag", () => {
      expectError("Indent `%>` to line up with the opening `<%=`. Expected 0 spaces but found 2.")

      assertOffenses("<%=\n  some_helper(\n    arg1\n  )\n  %>")
    })

    test("handles closing tag indented less than opening tag", () => {
      expectError("Indent `%>` to line up with the opening `<%=`. Expected 2 spaces but found 0.")

      assertOffenses("<div>\n  <%=\n    some_helper(\n      arg1\n    )\n%>\n</div>")
    })

    test("handles a closing tag that is one space off", () => {
      expectError("Indent `%>` to line up with the opening `<%=`. Expected 1 space but found 3.")

      assertOffenses("<div>\n <%=\n   some_helper(\n     arg1\n   )\n   %>\n</div>")
    })
  })
})
