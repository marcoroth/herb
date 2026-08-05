import { describe, test, expect, beforeAll } from "vitest"
import dedent from "dedent"
import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../../src/linter.js"
import { ERBCommentSyntax } from "../../src/rules/erb-comment-syntax.js"

describe("erb-comment-syntax autofix", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("fixes <% # comment %>", () => {
    const input = '<% # bad comment %>'
    const expected = '<%# bad comment %>'

    const linter = new Linter(Herb, [ERBCommentSyntax])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
    expect(result.unfixed).toHaveLength(0)
  })

  test("fixes <%= # comment %>", () => {
    const input = '<%= # bad comment %>'
    const expected = '<%# bad comment %>'

    const linter = new Linter(Herb, [ERBCommentSyntax])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
    expect(result.unfixed).toHaveLength(0)
  })

  test("fixes multiple bad comments in one file", () => {
    const input = dedent`
      <% # first bad comment %>
      <%= # second bad comment %>
    `

    const expected = dedent`
      <%# first bad comment %>
      <%# second bad comment %>
    `

    const linter = new Linter(Herb, [ERBCommentSyntax])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(2)
    expect(result.unfixed).toHaveLength(0)
  })

  test("fixes herb:disable with incorrect syntax", () => {
    const input = '<DIV></DIV><% # herb:disable html-tag-name-lowercase %>'
    const expected = '<DIV></DIV><%# herb:disable html-tag-name-lowercase %>'

    const linter = new Linter(Herb, [ERBCommentSyntax])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
    expect(result.unfixed).toHaveLength(0)
  })

  test("fixes herb:disable all with incorrect syntax", () => {
    const input = '<DIV></DIV><% # herb:disable all %>'
    const expected = '<DIV></DIV><%# herb:disable all %>'

    const linter = new Linter(Herb, [ERBCommentSyntax])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
    expect(result.unfixed).toHaveLength(0)
  })

  test("fixes herb:disable with extra whitespace", () => {
    const input = '<DIV></DIV><%  #  herb:disable html-tag-name-lowercase %>'
    const expected = '<DIV></DIV><%#  herb:disable html-tag-name-lowercase %>'

    const linter = new Linter(Herb, [ERBCommentSyntax])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
    expect(result.unfixed).toHaveLength(0)
  })

  test("preserves already correct ERB comment syntax", () => {
    const input = '<%# good comment %>'
    const expected = '<%# good comment %>'

    const linter = new Linter(Herb, [ERBCommentSyntax])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(0)
    expect(result.unfixed).toHaveLength(0)
  })

  test("preserves multi-line ERB with comment on new line", () => {
    const input = dedent`
      <%
        # good comment
      %>
    `

    const expected = dedent`
      <%
        # good comment
      %>
    `

    const linter = new Linter(Herb, [ERBCommentSyntax])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(0)
    expect(result.unfixed).toHaveLength(0)
  })

  test("fixes in complex template", () => {
    const input = dedent`
      <div>
        <% # bad comment %>
        <%= user.name %>
        <% # another bad comment %>
      </div>
    `

    const expected = dedent`
      <div>
        <%# bad comment %>
        <%= user.name %>
        <%# another bad comment %>
      </div>
    `

    const linter = new Linter(Herb, [ERBCommentSyntax])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(2)
    expect(result.unfixed).toHaveLength(0)
  })

  test("fixes <%== # comment %>", () => {
    const input = '<%== # escaped output comment %>'
    const expected = '<%# escaped output comment %>'

    const linter = new Linter(Herb, [ERBCommentSyntax])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
    expect(result.unfixed).toHaveLength(0)
  })

  test("fixes <%=   # with multiple spaces %>", () => {
    const input = '<%=   # comment with multiple spaces %>'
    const expected = '<%# comment with multiple spaces %>'

    const linter = new Linter(Herb, [ERBCommentSyntax])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
    expect(result.unfixed).toHaveLength(0)
  })

  test("fixes <%-  # trim tag %>", () => {
    const input = '<%-  # trim tag comment %>'
    const expected = '<%# trim tag comment %>'

    const linter = new Linter(Herb, [ERBCommentSyntax])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
    expect(result.unfixed).toHaveLength(0)
  })

  test("fixes <%    # with many spaces %>", () => {
    const input = '<%    # comment with many spaces %>'
    const expected = '<%# comment with many spaces %>'

    const linter = new Linter(Herb, [ERBCommentSyntax])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
    expect(result.unfixed).toHaveLength(0)
  })

  test("fixes all variations in one file", () => {
    const input = dedent`
      <% # regular %>
      <%= # output %>
      <%== # escaped output %>
      <%=   # multiple spaces %>
      <%-  # trim %>
      <%    # many spaces %>
    `

    const expected = dedent`
      <%# regular %>
      <%# output %>
      <%# escaped output %>
      <%# multiple spaces %>
      <%# trim %>
      <%# many spaces %>
    `

    const linter = new Linter(Herb, [ERBCommentSyntax])
    const result = linter.autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(6)
    expect(result.unfixed).toHaveLength(0)
  })
})
