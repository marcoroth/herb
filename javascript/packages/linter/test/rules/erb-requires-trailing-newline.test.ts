import dedent from "dedent"

import { describe, test } from "vitest"

import { ERBRequiresTrailingNewlineRule } from "../../src/rules/erb-requires-trailing-newline.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(ERBRequiresTrailingNewlineRule)

describe("ERBRequiresTrailingNewlineRule", () => {
  test("should not report errors for files ending with a trailing newline", () => {
    const html = dedent`
      <h1>
        <%= title %>
      </h1>
    ` + '\n'

    expectNoOffenses(html)
  })

  test("should not report errors for single newline files", () => {
    const html = "\n"

    expectNoOffenses(html)
  })

  test("should not report errors for files with multiple lines ending with newline", () => {
    const html = dedent`
      <%= render partial: "header" %>
      <%= render partial: "footer" %>
    ` + '\n'

    expectNoOffenses(html)
  })

  test("should report errors for files without trailing newline", () => {
    const html = dedent`
      <h1>
        <%= title %>
      </h1>
    `

    expectError("File must end with trailing newline")
    assertOffenses(html, { fileName: "test.html.erb" })
  })

  test("should report errors for single line files without newline", () => {
    const html = `<%= render partial: "header" %>`

    expectError("File must end with trailing newline")
    assertOffenses(html, { fileName: "test.html.erb" })
  })

  test("should handle files with mixed content without trailing newline", () => {
    const html = dedent`
      <div>
        <h1><%= @title %></h1>
        <% @items.each do |item| %>
          <p><%= item.name %></p>
        <% end %>
      </div>
    `

    expectError("File must end with trailing newline")
    assertOffenses(html, { fileName: "test.html.erb" })
  })

  test("should handle files with mixed content with trailing newline", () => {
    const html = dedent`
      <div>
        <h1><%= @title %></h1>
        <% @items.each do |item| %>
          <p><%= item.name %></p>
        <% end %>
      </div>
    ` + '\n'

    expectNoOffenses(html)
  })

  test("should handle ERB-only template without trailing newline", () => {
    const html = `<%= hello world %>`

    expectError("File must end with trailing newline")
    assertOffenses(html, { fileName: "test.html.erb" })
  })

  test("should handle ERB-only template with trailing newline", () => {
    const html = `<%= hello world %>` + '\n'

    expectNoOffenses(html)
  })

  test("should not flag empty file", () => {
    const html = ``

    expectNoOffenses(html)
  })

  test("should flag empty file with whitespace", () => {
    const html = ` `

    expectError("File must end with trailing newline")
    assertOffenses(html, { fileName: "test.html.erb" })
  })

  test("should not flag snippets without trailing newline (fileName: null)", () => {
    const html = dedent`
      <h1>
        <%= title %>
      </h1>
    `

    expectNoOffenses(html, { fileName: null })
  })

  test("should not flag single line snippets without trailing newline (fileName: null)", () => {
    const html = `<%= render partial: "header" %>`

    expectNoOffenses(html, { fileName: null })
  })

  test("should not flag single line snippets without trailing newline (fileName: undefined)", () => {
    const html = `<%= render partial: "header" %>`

    expectNoOffenses(html, { fileName: undefined })
  })

  test("should not flag single line snippets without trailing newline with no context", () => {
    const html = `<%= render partial: "header" %>`

    expectNoOffenses(html)
  })

  test("should flag files without trailing newline when fileName is provided", () => {
    const html = dedent`
      <h1>
        <%= title %>
      </h1>
    `

    expectError("File must end with trailing newline")
    assertOffenses(html, { fileName: "template.html.erb" })
  })
})
