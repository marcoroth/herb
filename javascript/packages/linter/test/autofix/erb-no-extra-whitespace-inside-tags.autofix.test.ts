import { describe, test, expect, beforeAll } from "vitest"
import dedent from "dedent"
import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../../src/linter.js"
import { ERBNoExtraWhitespaceRule } from "../../src/rules/erb-no-extra-whitespace-inside-tags.js"

describe("erb-no-extra-whitespace-inside-tags autofix", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("removes extra space after opening tag", () => {
    const input = '<%  if true %>\n<% end %>'
    const expected = '<% if true %>\n<% end %>'

    const linter = new Linter(Herb, [ERBNoExtraWhitespaceRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
    expect(result.unfixed).toHaveLength(0)
  })

  test("removes extra space before closing tag", () => {
    const input = '<% if admin  %>\n<% end %>'
    const expected = '<% if admin %>\n<% end %>'

    const linter = new Linter(Herb, [ERBNoExtraWhitespaceRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
  })

  test("removes extra spaces after opening and before closing", () => {
    const input = '<%  if true  %><% end %>'
    const expected = '<% if true %><% end %>'

    const linter = new Linter(Herb, [ERBNoExtraWhitespaceRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(2)
  })

  test("fixes ERB output tags with extra spaces", () => {
    const input = '<%=  user.name  %>'
    const expected = '<%= user.name %>'

    const linter = new Linter(Herb, [ERBNoExtraWhitespaceRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(2)
  })

  test("fixes ERB comment tags with extra spaces", () => {
    const input = '<%#  This is a comment  %>'
    const expected = '<%# This is a comment %>'

    const linter = new Linter(Herb, [ERBNoExtraWhitespaceRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(2)
  })

  test("fixes ERB comment tags with equals and extra spaces", () => {
    const input = '<%#=  link_to "path", path  %>'
    const expected = '<%#= link_to "path", path %>'

    const linter = new Linter(Herb, [ERBNoExtraWhitespaceRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(2)
  })

  test("fixes multiple ERB tags with extra spaces", () => {
    const input = dedent`
      <%  if admin  %>
        Hello, <%=  user.name  %>.
      <%  end  %>
    `

    const expected = dedent`
      <% if admin %>
        Hello, <%= user.name %>.
      <% end %>
    `

    const linter = new Linter(Herb, [ERBNoExtraWhitespaceRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(6)
  })

  test("preserves already correct whitespace", () => {
    const input = '<% if admin %>\n  Hello\n<% end %>'
    const expected = '<% if admin %>\n  Hello\n<% end %>'

    const linter = new Linter(Herb, [ERBNoExtraWhitespaceRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(0)
  })

  test("handles tags with three or more spaces", () => {
    const input = '<%    if admin    %><% end %>'
    const expected = '<% if admin %><% end %>'

    const linter = new Linter(Herb, [ERBNoExtraWhitespaceRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(2)
  })

  test("fixes only opening whitespace when needed", () => {
    const input = '<%  if user %><% end %>'
    const expected = '<% if user %><% end %>'

    const linter = new Linter(Herb, [ERBNoExtraWhitespaceRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
  })

  test("fixes only closing whitespace when needed", () => {
    const input = '<% if admin  %><% end %>'
    const expected = '<% if admin %><% end %>'

    const linter = new Linter(Herb, [ERBNoExtraWhitespaceRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
  })

  test("handles mixed correct and incorrect tags", () => {
    const input = '<% if admin %>\n  <%=  name  %>\n<% end %>'
    const expected = '<% if admin %>\n  <%= name %>\n<% end %>'

    const linter = new Linter(Herb, [ERBNoExtraWhitespaceRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(2)
  })

  test("handles tabs mixed with spaces", () => {
    const input = '<%  \tif true %>\n<% end %>'
    const expected = '<% if true %>\n<% end %>'

    const linter = new Linter(Herb, [ERBNoExtraWhitespaceRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
  })

  test("preserves multiline ERB tags", () => {
    const input = '<%\n  if admin\n%><% end %>'
    const expected = '<%\n  if admin\n%><% end %>'

    const linter = new Linter(Herb, [ERBNoExtraWhitespaceRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(0)
  })

  test("fixes complex template with multiple issues", () => {
    const input = dedent`
      <%=  user.name  %>
      <%  if admin  %>
        <h1>Hello</h1>
      <%  end  %>
      <%= user.email %>
    `

    const expected = dedent`
      <%= user.name %>
      <% if admin %>
        <h1>Hello</h1>
      <% end %>
      <%= user.email %>
    `

    const linter = new Linter(Herb, [ERBNoExtraWhitespaceRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(6)
  })

  test("doesn't autofix report multi-line whitespace", () => {
    const input = dedent`
      <h3>
        <%= render partial: "posts/post",
                   locals: {},
                   as: :post
        %>
      </h3>
    `
    const linter = new Linter(Herb, [ERBNoExtraWhitespaceRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(input)
    expect(result.fixed).toHaveLength(0)
  })

  test("fixes complex template with multiple issues", () => {
    const input = dedent`
      <h3>
        <%=  render partial: "posts/post",
                    locals: {},
                    as: :post
        %>
      </h3>
    `

    const expected = dedent`
      <h3>
        <%= render partial: "posts/post",
                    locals: {},
                    as: :post
        %>
      </h3>
    `

    const linter = new Linter(Herb, [ERBNoExtraWhitespaceRule])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
  })
})
