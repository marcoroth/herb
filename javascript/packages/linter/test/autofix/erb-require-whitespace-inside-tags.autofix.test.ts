import { describe, test, expect, beforeAll } from "vitest"
import dedent from "dedent"
import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../../src/linter.js"
import { ERBRequireWhitespaceRule } from "../../src/rules/erb-require-whitespace-inside-tags.js"

describe("erb-require-whitespace-inside-tags autofix", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("adds space after opening tag", () => {
    const input = '<%if true %>\n<% end %>'
    const expected = '<% if true %>\n<% end %>'

    const linter = new Linter(Herb, [ERBRequireWhitespaceRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
    expect(result.unfixed).toHaveLength(0)
  })

  test("adds space before closing tag", () => {
    const input = '<% if admin%>\n<% end %>'
    const expected = '<% if admin %>\n<% end %>'

    const linter = new Linter(Herb, [ERBRequireWhitespaceRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
  })

  test("adds spaces after opening and before closing", () => {
    const input = '<%if true%><% end %>'
    const expected = '<% if true %><% end %>'

    const linter = new Linter(Herb, [ERBRequireWhitespaceRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(2)
  })

  test("fixes ERB output tags", () => {
    const input = '<%=user.name%>'
    const expected = '<%= user.name %>'

    const linter = new Linter(Herb, [ERBRequireWhitespaceRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(2)
  })

  test("fixes ERB comment tags", () => {
    const input = '<%#This is a comment%>'
    const expected = '<%# This is a comment %>'

    const linter = new Linter(Herb, [ERBRequireWhitespaceRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(2)
  })

  test("fixes multiple ERB tags", () => {
    const input = dedent`
      <%if admin%>
        Hello, <%=user.name%>.
      <%end%>
    `

    const expected = dedent`
      <% if admin %>
        Hello, <%= user.name %>.
      <% end %>
    `

    const linter = new Linter(Herb, [ERBRequireWhitespaceRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(6)
  })

  test("preserves already correct whitespace", () => {
    const input = '<% if admin %>\n  Hello\n<% end %>'
    const expected = '<% if admin %>\n  Hello\n<% end %>'

    const linter = new Linter(Herb, [ERBRequireWhitespaceRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(0)
  })

  test("handles tags with newlines", () => {
    const input = '<%\n  if admin\n%><% end %>'
    const expected = '<%\n  if admin\n%><% end %>'

    const linter = new Linter(Herb, [ERBRequireWhitespaceRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(0)
  })

  test("fixes only opening whitespace when needed", () => {
    const input = '<%if user %><% end %>'
    const expected = '<% if user %><% end %>'

    const linter = new Linter(Herb, [ERBRequireWhitespaceRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
  })

  test("fixes only closing whitespace when needed", () => {
    const input = '<% if admin%><% end %>'
    const expected = '<% if admin %><% end %>'

    const linter = new Linter(Herb, [ERBRequireWhitespaceRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
  })

  test("handles mixed correct and incorrect tags", () => {
    const input = '<% if admin %>\n  <%=name%>\n<% end %>'
    const expected = '<% if admin %>\n  <%= name %>\n<% end %>'

    const linter = new Linter(Herb, [ERBRequireWhitespaceRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(2)
  })
})
