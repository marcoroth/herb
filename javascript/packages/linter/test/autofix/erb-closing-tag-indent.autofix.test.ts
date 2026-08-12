import { describe, test, expect, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"

import { Linter } from "../../src/linter.js"
import { ERBClosingTagIndentRule } from "../../src/rules/erb-closing-tag-indent.js"
import dedent from "dedent"

describe("erb-closing-tag-indent autofix", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("removes newline before closing tag when opening is not followed by newline", () => {
    const input = '<%= title\n%>'
    const expected = '<%= title %>'

    const linter = new Linter(Herb, [ERBClosingTagIndentRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
  })

  test("removes newline and indentation before closing tag", () => {
    const input = '<%= title\n  %>'
    const expected = '<%= title %>'

    const linter = new Linter(Herb, [ERBClosingTagIndentRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
  })

  test("moves a block ERB comment closing tag onto the content line", () => {
    const input = dedent`
      <%# Non-link tag that stands for skipped pages...
        - available local variables
          current_page:  a page object for the currently displayed page
          total_pages:   total number of pages
          per_page:      number of items to fetch per page
          remote:        data-remote
      -%>
    `
    const expected = dedent`
      <%# Non-link tag that stands for skipped pages...
        - available local variables
          current_page:  a page object for the currently displayed page
          total_pages:   total number of pages
          per_page:      number of items to fetch per page
          remote:        data-remote -%>
    `

    const linter = new Linter(Herb, [ERBClosingTagIndentRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
    expect(linter.lint(result.source).offenses).toHaveLength(0)
  })

  test("adds newline before closing tag when opening is followed by newline", () => {
    const input = '<%=\n  title %>'
    const expected = '<%=\n  title\n%>'

    const linter = new Linter(Herb, [ERBClosingTagIndentRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
  })

  test("preserves horizontal whitespace before the opening newline", () => {
    const input = "<%= \n  title %>"
    const expected = "<%= \n  title\n%>"

    const linter = new Linter(Herb, [ERBClosingTagIndentRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
  })

  test("adds indentation to closing tag to match opening tag", () => {
    const input = '<%=\n  title\n  %>'
    const expected = '<%=\n  title\n%>'

    const linter = new Linter(Herb, [ERBClosingTagIndentRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
  })

  test("preserves already correct single-line tags", () => {
    const input = dedent`
      <% if admin? %>
        Hello
      <% end %>
    `

    const linter = new Linter(Herb, [ERBClosingTagIndentRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(input)
    expect(result.fixed).toHaveLength(0)
  })

  test("preserves already correct multi-line tags", () => {
    const input = dedent`
      <%=
        title
      %>
    `

    const linter = new Linter(Herb, [ERBClosingTagIndentRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(input)
    expect(result.fixed).toHaveLength(0)
  })

  test("preserves the newline after a heredoc terminator", () => {
    const input = dedent`
      <%= render(<<~TEXT)
        hello
      TEXT
      %>
    `

    const linter = new Linter(Herb, [ERBClosingTagIndentRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(input)
    expect(result.fixed).toHaveLength(0)
  })

  test("fixes closing tag indentation without changing a heredoc terminator", () => {
    const input = "  <%= render(<<~TEXT)\n    hello\n  TEXT\n    %>"
    const expected = "  <%= render(<<~TEXT)\n    hello\n  TEXT\n  %>"

    const linter = new Linter(Herb, [ERBClosingTagIndentRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
    expect(Herb.parse(result.source).successful).toBe(true)
  })

  test("does not reindent surrounding content while fixing a nested ERB tag", () => {
    const input = dedent`
      <li>
      <%
        value = true
        %>
      </li>
    `
    const expected = dedent`
      <li>
      <%
        value = true
      %>
      </li>
    `

    const linter = new Linter(Herb, [ERBClosingTagIndentRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
    expect(linter.lint(result.source).offenses).toHaveLength(0)
  })
})
