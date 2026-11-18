import dedent from "dedent"
import { describe, test, expect } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Config } from "@herb-tools/config"
import { Linter } from "../../src/linter.js"
import { ERBNoTrailingCommentRule } from "../../src/rules/erb-no-trailing-comment.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, expectWarning, assertOffenses } = createLinterTest(ERBNoTrailingCommentRule)

const MESSAGE = "A Ruby comment at the end of an ERB tag also comments out the code that the template engine appends after the tag. Move the comment into a separate `<%# %>` tag, or put the closing `%>` on its own line."
const FRAGILE_MESSAGE = "Avoid Ruby comments at the end of ERB tags. This tag still renders correctly, but the comment breaks the template as soon as anything else is added to this line or the template is rendered by an engine that doesn't trim it. Move the comment into a separate `<%# %>` tag, or put the closing `%>` on its own line."

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

  test("warns for a trailing comment in an end tag on its own line", () => {
    expectWarning(FRAGILE_MESSAGE, { line: 3, column: 7 })

    assertOffenses(dedent`
      <% if some_method %>
        Hello
      <% end # if some_method %>
    `)
  })

  test("warns for a trailing comment in a block tag on its own line", () => {
    expectWarning(FRAGILE_MESSAGE, { line: 1, column: 24 })

    assertOffenses(dedent`
      <% items.each do |item| # loop %>
        <%= item %>
      <% end %>
    `, { allowInvalidSyntax: true })
  })

  test("warns for a trailing comment with trimming tags on their own line", () => {
    expectWarning(FRAGILE_MESSAGE, { line: 1, column: 8 })

    assertOffenses(`<%- foo # comment -%>`)
  })

  test("fails for a trailing comment with trimming tags followed by text", () => {
    expectError(MESSAGE, { line: 1, column: 8 })

    assertOffenses(`<%- foo # comment -%>Hello`)
  })

  test("warns for a trailing comment in an indented tag on its own line", () => {
    expectWarning(FRAGILE_MESSAGE, { line: 3, column: 9 })

    assertOffenses(dedent`
      <div>
        <% if some_method %>
        <% end # if some_method %>
      </div>
    `)
  })

  test("warns for a trailing comment in a tab-indented tag on its own line", () => {
    expectWarning(FRAGILE_MESSAGE, { line: 2, column: 8 })

    assertOffenses(`<% if some_method %>\n\t<% end # if some_method %>\n`)
  })

  test("warns for a trailing comment in a tag followed by whitespace", () => {
    expectWarning(FRAGILE_MESSAGE, { line: 2, column: 7 })

    assertOffenses(`<% if some_method %>\n<% end # if some_method %>  \nHello`)
  })

  test("warns for a trailing comment in a tag on its own line with CRLF line endings", () => {
    expectWarning(FRAGILE_MESSAGE, { line: 2, column: 7 })

    assertOffenses(`<% if some_method %>\r\n<% end # if some_method %>\r\nHello\r\n`)
  })

  test("fails for a trailing comment in an end tag followed by text", () => {
    expectError(MESSAGE, { line: 2, column: 7 })

    assertOffenses(dedent`
      <div><% if some_method %>
      <% end # if some_method %></div>
    `)
  })

  test("fails for a trailing comment in a silent tag preceded by text", () => {
    expectError(MESSAGE, { line: 1, column: 23 })

    assertOffenses(`<div><% name = "World" # comment %>\n</div>`)
  })

  test("fails for a trailing comment in a block output tag on its own line", () => {
    expectError(MESSAGE, { line: 1, column: 24 })

    assertOffenses(dedent`
      <%= form_with do |form| # form %>
        <%= form.text_field :name %>
      <% end %>
    `)
  })

  test("fails for a trailing comment in an output tag on its own line", () => {
    expectError(MESSAGE, { line: 2, column: 10 })

    assertOffenses(`<div>\n  <%= foo # comment %>\n</div>`)
  })

  test("fails for a trailing comment in a tag with non-ASCII characters followed by text", () => {
    expectError(MESSAGE, { line: 1, column: 12 })

    assertOffenses(`<% x = "😀" # comment %>Hello`)
  })

  test("warns for a trailing comment in a tag with non-ASCII characters on its own line", () => {
    expectWarning(FRAGILE_MESSAGE, { line: 1, column: 12 })

    assertOffenses(`<% x = "😀" # comment %>\nHello`)
  })

  test("fails for a trailing comment in a raw output tag", () => {
    expectError(MESSAGE, { line: 1, column: 9 })

    assertOffenses(`<%== foo # comment %>`)
  })

  test("fails for a trailing comment without trailing whitespace", () => {
    expectError(MESSAGE, { line: 1, column: 8 })

    assertOffenses(`<%= foo # comment%>`)
  })

  test("warns for a trailing comment on the last line of a multi-line tag on its own lines", () => {
    expectWarning(FRAGILE_MESSAGE, { line: 3, column: 6, endLine: 3, endColumn: 15 })

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

  test("warns when the template engine is herb", () => {
    expectWarning(FRAGILE_MESSAGE)

    assertOffenses(`<%= I18n.t("Hello") # comment %>`, { templateEngine: "herb" })
  })

  test("fails when the template engine is erb", () => {
    expectError(MESSAGE)

    assertOffenses(`<%= foo # comment %>`, { templateEngine: "erb" })
  })

  test("fails when the template engine is erubi", () => {
    expectError(MESSAGE)

    assertOffenses(`<%= foo # comment %>`, { templateEngine: "erubi" })
  })

  test("passes for a herb:debug disable comment when the template engine is herb", () => {
    expectNoOffenses(`<%= tag.td "Ada" # herb:debug disable %>`, { templateEngine: "herb" })
    expectNoOffenses(`<%= tag.td "Ada" #   herb:debug   disable %>`, { templateEngine: "herb" })
  })

  test("passes for a herb:debug disable comment on a block opening when the template engine is herb", () => {
    expectNoOffenses(dedent`
      <%= content_for :head do # herb:debug disable %>
        <%= stylesheet_link_tag "application" %>
      <% end %>
    `, { templateEngine: "herb" })
  })

  test("fails for a herb:debug disable comment under other template engines", () => {
    expectError(MESSAGE)

    assertOffenses(`<%= tag.td "Ada" # herb:debug disable %>`, { templateEngine: "erubi" })
  })

  test("warns for a comment that only mentions herb:debug disable", () => {
    expectWarning(FRAGILE_MESSAGE)

    assertOffenses(`<%= foo # herb:debug disable later %>`, { templateEngine: "herb" })
  })

  test("reads the template engine from the config", async () => {
    await Herb.load()

    const source = `<%= foo # comment %>`

    const herbConfig = Config.fromObject({ template_engine: "herb" })
    const herbLinter = new Linter(Herb, [ERBNoTrailingCommentRule], herbConfig)

    expect(herbLinter.lint(source).offenses.map(offense => offense.severity)).toEqual(["warning"])

    const erubiConfig = Config.fromObject({ template_engine: "erubi" })
    const erubiLinter = new Linter(Herb, [ERBNoTrailingCommentRule], erubiConfig)

    expect(erubiLinter.lint(source).offenses.map(offense => offense.severity)).toEqual(["error"])
  })
})
