import dedent from "dedent"
import { describe, test, expect } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Config } from "@herb-tools/config"
import { Linter } from "../../src/linter.js"
import { ERBNoTrailingCommentRule } from "../../src/rules/erb-no-trailing-comment.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(ERBNoTrailingCommentRule)

const MESSAGE = "A Ruby comment at the end of an ERB tag also comments out the code that the template engine appends after the tag. Move the comment into a separate `<%# %>` tag, or put the closing `%>` on its own line."

describe("erb-no-trailing-comment", () => {
  test("passes for tags without comments", () => {
    expectNoOffenses(dedent`
      <%= I18n.t("Hello") %>
      <% name = "World" %>Hello, <%= name %>!
    `)
  })

  test("passes for a separate ERB comment tag", () => {
    expectNoOffenses(`<%= I18n.t("Hello") %><%# comment %>`)
  })

  test("passes for a comment followed by a newline inside the tag", () => {
    expectNoOffenses(dedent`
      <%
        name = "World" # comment
      %>Hello, <%= name %>!
    `)
  })

  test("passes for a comment followed by a newline and indentation inside the tag", () => {
    expectNoOffenses(`<%= foo # comment\n  %>`)
  })

  test("passes for a `#` inside a string", () => {
    expectNoOffenses(`<%= "Item #1" %>`)
    expectNoOffenses(`<%= "#{first_name} #{last_name}" %>`)
    expectNoOffenses(`<%= link_to "Top", "#top" %>`)
  })

  test("passes for a `#` in a method call", () => {
    expectNoOffenses(`<%= Object.instance_method(:to_s).bind_call(self) %>`)
    expectNoOffenses(`<%= foo ? "a" : "#" %>`)
  })

  test("ignores comment-only tags, which are covered by erb-comment-syntax", () => {
    expectNoOffenses(`<% # comment %>`)
    expectNoOffenses(`<%= # comment %>`)
  })

  test("ignores ERB comment tags", () => {
    expectNoOffenses(`<%# foo # comment %>`)
  })

  test("ignores escaped ERB tags", () => {
    expectNoOffenses(`<%% foo # comment %>`)
  })

  test("fails for a trailing comment in an output tag", () => {
    expectError(MESSAGE, { line: 1, column: 20, endLine: 1, endColumn: 29 })

    assertOffenses(`<%= I18n.t("Hello") # comment %>`)
  })

  test("fails for a trailing comment in a silent tag", () => {
    expectError(MESSAGE, { line: 1, column: 18 })

    assertOffenses(`<% name = "World" # comment %>Hello, <%= name %>!`)
  })

  test("fails for a trailing comment in a control flow tag", () => {
    expectError(MESSAGE, { line: 1, column: 18 })

    assertOffenses(`<% if some_method # comment %><% end %>`, { allowInvalidSyntax: true })
  })

  test("fails for a trailing comment in an end tag", () => {
    expectError(MESSAGE, { line: 3, column: 7 })

    assertOffenses(dedent`
      <% if some_method %>
        Hello
      <% end # if some_method %>
    `)
  })

  test("fails for a trailing comment in a block tag", () => {
    expectError(MESSAGE, { line: 1, column: 24 })

    assertOffenses(dedent`
      <% items.each do |item| # loop %>
        <%= item %>
      <% end %>
    `, { allowInvalidSyntax: true })
  })

  test("fails for a trailing comment with trimming tags", () => {
    expectError(MESSAGE, { line: 1, column: 8 })

    assertOffenses(`<%- foo # comment -%>`)
  })

  test("fails for a trailing comment in a raw output tag", () => {
    expectError(MESSAGE, { line: 1, column: 9 })

    assertOffenses(`<%== foo # comment %>`)
  })

  test("fails for a trailing comment without trailing whitespace", () => {
    expectError(MESSAGE, { line: 1, column: 8 })

    assertOffenses(`<%= foo # comment%>`)
  })

  test("fails for a trailing comment on the last line of a multi-line tag", () => {
    expectError(MESSAGE, { line: 3, column: 6, endLine: 3, endColumn: 15 })

    assertOffenses(dedent`
      <%
        foo # first
        bar # comment %>
    `)
  })

  test("fails for a trailing comment after a string containing `#`", () => {
    expectError(MESSAGE, { line: 1, column: 14 })

    assertOffenses(`<%= "Item #1" # comment %>`)
  })

  test("fails for a comment-only tag that starts with a newline", () => {
    expectError(MESSAGE, { line: 2, column: 2 })

    assertOffenses(`<%\n  # comment %>Hello`)
  })

  test("fails for a trailing comment that contains non-ASCII characters", () => {
    expectError(MESSAGE, { line: 1, column: 12, endLine: 1, endColumn: 18 })

    assertOffenses(`<%= "héllo" # コメント %>`)
  })

  test("reports only the tag with a trailing comment when tags share a line", () => {
    expectError(MESSAGE, { line: 1, column: 19, endLine: 1, endColumn: 28 })

    assertOffenses(`<%= foo %> <%= bar # comment %> <%= baz %>`)
  })

  test("reports each tag with a trailing comment", () => {
    expectError(MESSAGE, { line: 1 })
    expectError(MESSAGE, { line: 2 })

    assertOffenses(dedent`
      <%= foo # one %>
      <%= bar # two %>
    `)
  })

  test("passes when the template engine is herb", () => {
    expectNoOffenses(`<%= I18n.t("Hello") # comment %>`, { templateEngine: "herb" })
  })

  test("fails when the template engine is erb", () => {
    expectError(MESSAGE)

    assertOffenses(`<%= foo # comment %>`, { templateEngine: "erb" })
  })

  test("fails when the template engine is erubi", () => {
    expectError(MESSAGE)

    assertOffenses(`<%= foo # comment %>`, { templateEngine: "erubi" })
  })

  test("reads the template engine from the config", async () => {
    await Herb.load()

    const source = `<%= foo # comment %>`

    const herbConfig = Config.fromObject({ template_engine: "herb" })
    const herbLinter = new Linter(Herb, [ERBNoTrailingCommentRule], herbConfig)

    expect(herbLinter.lint(source).offenses).toHaveLength(0)

    const erubiConfig = Config.fromObject({ template_engine: "erubi" })
    const erubiLinter = new Linter(Herb, [ERBNoTrailingCommentRule], erubiConfig)

    expect(erubiLinter.lint(source).offenses).toHaveLength(1)
  })
})
