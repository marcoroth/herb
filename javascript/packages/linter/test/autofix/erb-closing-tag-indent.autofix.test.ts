import dedent from "dedent"

import { describe, test, expect, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../../src/linter.js"

import { ERBClosingTagIndentRule } from "../../src/rules/erb-closing-tag-indent.js"

describe("erb-closing-tag-indent autofix", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  const linter = () => new Linter(Herb, [ERBClosingTagIndentRule])

  const expectFixed = (input: string, expected: string, fixedCount = 1) => {
    const result = linter().autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(fixedCount)
    expect(linter().lint(result.source).offenses).toHaveLength(0)
  }

  const expectUnchanged = (input: string) => {
    const result = linter().autofix(input)

    expect(result.source).toBe(input)
    expect(result.fixed).toHaveLength(0)
  }

  describe("collapsing a single line of code", () => {
    test("collapses a leading and a trailing newline", () => {
      expectFixed("<%=\n  title\n%>", "<%= title %>")
    })

    test("collapses a leading newline", () => {
      expectFixed("<%=\n  title %>", "<%= title %>")
    })

    test("collapses a trailing newline", () => {
      expectFixed("<%= title\n%>", "<%= title %>")
    })

    test("collapses horizontal whitespace before the opening newline", () => {
      expectFixed("<%= \t\n  title\n%>", "<%= title %>")
    })

    test("collapses a control-flow tag without touching its body", () => {
      expectFixed(
        "<%\n  if admin?\n%>\n  <h1>Content</h1>\n<% end %>",
        "<% if admin? %>\n  <h1>Content</h1>\n<% end %>"
      )
    })
  })

  describe("moving the closing tag onto its own line", () => {
    test("adds a newline before the closing tag", () => {
      expectFixed(
        "<%=\n  some_helper(\n    arg1,\n    arg2\n  ) %>",
        "<%=\n  some_helper(\n    arg1,\n    arg2\n  )\n%>"
      )
    })

    test("indents the closing tag to match the opening tag", () => {
      expectFixed(
        "<div>\n  <%=\n    some_helper(\n      arg1\n    )\n%>\n</div>",
        "<div>\n  <%=\n    some_helper(\n      arg1\n    )\n  %>\n</div>"
      )
    })

    test("does not reindent surrounding content while fixing a nested ERB tag", () => {
      expectFixed(
        dedent`
          <div>
              <span>kept</span>
              <%=
                some_helper(
                  arg1
                )
                %>
          </div>
        `,
        dedent`
          <div>
              <span>kept</span>
              <%=
                some_helper(
                  arg1
                )
              %>
          </div>
        `
      )
    })
  })

  describe("moving the closing tag up to the code", () => {
    test("removes a newline before the closing tag", () => {
      expectFixed(
        "<%= some_helper(\n  arg1,\n  arg2\n)\n%>",
        "<%= some_helper(\n  arg1,\n  arg2\n) %>"
      )
    })
  })

  describe("heredocs", () => {
    test("leaves the closing tag on its own line after a heredoc terminator", () => {
      expectUnchanged(dedent`
        <%= render(<<~TEXT)
          hello
        TEXT
        %>
      `)
    })

    test("fixes the indentation without moving the closing tag onto the terminator line", () => {
      expectFixed(
        "<%= render(<<~TEXT)\n  hello\nTEXT\n  %>",
        "<%= render(<<~TEXT)\n  hello\nTEXT\n%>"
      )
    })
  })

  describe("tags the rule leaves alone", () => {
    test("preserves already correct single-line tags", () => {
      expectUnchanged(dedent`
        <% if admin? %>
          <h1>Content</h1>
        <% end %>
      `)
    })

    test("preserves already correct multi-line tags", () => {
      expectUnchanged(dedent`
        <%=
          some_helper(
            arg1,
            arg2
          )
        %>
      `)
    })

    test("preserves whitespace trimming tags", () => {
      expectUnchanged("<%=\n  title\n  -%>")
    })

    test("preserves ERB comments", () => {
      expectUnchanged("<%#\n  a note\n  %>")
    })

    test("preserves a tag holding only a Ruby comment", () => {
      expectUnchanged('<%=\n# render_partial("_pagination")\n%>')
    })

    test("preserves a tag whose last line of code carries a comment", () => {
      expectUnchanged("<%= title # the page title\n%>")
    })

    test("preserves a `=begin` block comment delimiter", () => {
      expectUnchanged("<%\n=begin\n%>\n<p>Commented out</p>\n<%\n=end\n%>")
    })

    test("preserves ERB inside an attribute value", () => {
      expectUnchanged(dedent`
        <li class="<%=
          class_names(
            "page-item",
            disabled: current_page.first?
          )
        %>">First</li>
      `)
    })
  })
})
