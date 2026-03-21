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

  test("adds newline before closing tag when opening is followed by newline", () => {
    const input = '<%=\n  title %>'
    const expected = '<%=\n  title\n%>'

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
})
