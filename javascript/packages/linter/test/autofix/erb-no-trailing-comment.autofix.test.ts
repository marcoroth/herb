import dedent from "dedent"

import { describe, test, expect, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../../src/linter.js"

import { ERBNoTrailingCommentRule } from "../../src/rules/erb-no-trailing-comment.js"

function autofix(input: string, includeUnsafe = true) {
  const linter = new Linter(Herb, [ERBNoTrailingCommentRule])

  return linter.autofix(input, { fileName: "test.html.erb" }, undefined, { includeUnsafe })
}

describe("erb-no-trailing-comment autofix", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("fixes a tag that breaks rendering without --fix-unsafely", () => {
    const result = autofix(`<%= I18n.t("Hello") # comment %>`, false)

    expect(result.source).toBe(`<%= I18n.t("Hello") %><%# comment %>`)
    expect(result.fixed).toHaveLength(1)
  })

  test("does not fix a tag on its own line without --fix-unsafely", () => {
    const input = dedent`
      <% if some_method %>
        Hello
      <% end # if some_method %>
    `

    const result = autofix(input, false)

    expect(result.source).toBe(input)
    expect(result.fixed).toHaveLength(0)
    expect(result.unfixed).toHaveLength(1)
  })

  test("moves the comment of an output tag into an ERB comment tag", () => {
    const result = autofix(`<%= I18n.t("Hello") # comment %>`)

    expect(result.source).toBe(`<%= I18n.t("Hello") %><%# comment %>`)
    expect(result.fixed).toHaveLength(1)
    expect(result.unfixed).toHaveLength(0)
  })

  test("moves the comment of a silent tag into an ERB comment tag", () => {
    const result = autofix(`<% name = "World" # comment %>Hello, <%= name %>!`)

    expect(result.source).toBe(`<% name = "World" %><%# comment %>Hello, <%= name %>!`)
    expect(result.fixed).toHaveLength(1)
  })

  test("moves the comment of a control flow tag into an ERB comment tag", () => {
    const input = dedent`
      <% if some_method # comment %>
        Hello
      <% end %>
    `

    const expected = dedent`
      <% if some_method %><%# comment %>
        Hello
      <% end %>
    `

    const result = autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
  })

  test("does not fix a template with parse errors", () => {
    const input = `<% if some_method # comment %><% end %>`
    const result = autofix(input)

    expect(result.source).toBe(input)
    expect(result.fixed).toHaveLength(0)
    expect(result.unfixed.filter(offense => offense.rule === "erb-no-trailing-comment")).toHaveLength(1)
  })

  test("moves the comment of an end tag into an ERB comment tag", () => {
    const input = dedent`
      <% if some_method %>
        Hello
      <% end # if some_method %>
    `

    const expected = dedent`
      <% if some_method %>
        Hello
      <% end %><%# if some_method %>
    `

    const result = autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(1)
  })

  test("keeps the trim markers on the outer ends of the tags", () => {
    const result = autofix(`<%- foo # comment -%>`)

    expect(result.source).toBe(`<%- foo %><%# comment -%>`)
  })

  test("keeps raw output tags", () => {
    const result = autofix(`<%== foo # comment %>`)

    expect(result.source).toBe(`<%== foo %><%# comment %>`)
  })

  test("keeps the whitespace of the comment when the original has none", () => {
    const result = autofix(`<%= foo #comment%>`)

    expect(result.source).toBe(`<%= foo %><%#comment%>`)
  })

  test("only moves the trailing comment of a multi-line tag", () => {
    const input = dedent`
      <%
        foo # first
        bar # second %>
    `

    const expected = dedent`
      <%
        foo # first
        bar %><%# second %>
    `

    expect(autofix(input).source).toBe(expected)
  })

  test("keeps the line break before a comment on its own line", () => {
    const input = dedent`
      <% foo
         # comment %>
    `

    const expected = dedent`
      <% foo
         %><%# comment %>
    `

    expect(autofix(input).source).toBe(expected)
  })

  test("keeps a heredoc terminator alone on its line", () => {
    const input = dedent`
      <%= <<~TEXT
        hello
      TEXT
      # comment %>
    `

    const expected = dedent`
      <%= <<~TEXT
        hello
      TEXT
      %><%# comment %>
    `

    expect(autofix(input).source).toBe(expected)
  })

  test("keeps whitespace other than spaces and tabs before the comment", () => {
    const result = autofix(`<%= foo　# comment %>`)

    expect(result.source).toBe(`<%= foo　 %><%# comment %>`)
  })

  test("fixes every tag with a trailing comment", () => {
    const input = dedent`
      <%= foo # one %>
      <%= bar # two %>
    `

    const expected = dedent`
      <%= foo %><%# one %>
      <%= bar %><%# two %>
    `

    const result = autofix(input)

    expect(result.source).toBe(expected)
    expect(result.fixed).toHaveLength(2)
  })

  test("does not fix a tag that contains only a comment", () => {
    const input = `<%\n  # comment %>Hello`
    const result = autofix(input)

    expect(result.source).toBe(input)
    expect(result.fixed).toHaveLength(0)
    expect(result.unfixed).toHaveLength(1)
  })
})
