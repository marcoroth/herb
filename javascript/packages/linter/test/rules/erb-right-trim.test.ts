import dedent from "dedent"
import { describe, test } from "vitest"
import { ERBRightTrimRule } from "../../src/rules/erb-right-trim.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(ERBRightTrimRule)

describe("ERBRightTrimRule", () => {
  test("when the erb tag close with %>", () => {
    expectNoOffenses(dedent`
      <h1>
        <%= title %>
      </h1>
    `)
  })

  test("when output erb tag closes with -%>", () => {
    expectNoOffenses(dedent`
      <h1>
        <%= title -%>
      </h1>
    `)
  })

  test("when non-output tag uses -%>", () => {
    expectNoOffenses(dedent`
      <% if condition -%>
        <p>Content</p>
      <% elsif other_condition -%>
        <p>Content</p>
      <% elsif yet_another_condition -%>
        <p>Content</p>
      <% else -%>
        <p>Content</p>
      <% end -%>
    `)
  })

  test("when the erb tag close with =%>", () => {
    expectError("Use `-%>` instead of `=%>` for right-trimming. The `=%>` syntax is obscure and not well-supported in most ERB engines.")

    assertOffenses(dedent`
      <h1>
        <%= title =%>
      </h1>
    `)
  })

  test("when an if block uses =%>", () => {
    expectError("Use `-%>` instead of `=%>` for right-trimming. The `=%>` syntax is obscure and not well-supported in most ERB engines.")
    expectError("Use `-%>` instead of `=%>` for right-trimming. The `=%>` syntax is obscure and not well-supported in most ERB engines.")

    assertOffenses(dedent`
      <% if condition =%>
        <p>Content</p>
      <% end =%>
    `)
  })

  test("when a loop uses =%>", () => {
    expectError("Use `-%>` instead of `=%>` for right-trimming. The `=%>` syntax is obscure and not well-supported in most ERB engines.")

    assertOffenses(dedent`
      <% items.each do |item| =%>
        <li><%= item %></li>
      <% end %>
    `)
  })

  test("when multiple lines use =%>", () => {
    expectError("Use `-%>` instead of `=%>` for right-trimming. The `=%>` syntax is obscure and not well-supported in most ERB engines.")
    expectError("Use `-%>` instead of `=%>` for right-trimming. The `=%>` syntax is obscure and not well-supported in most ERB engines.")
    expectError("Use `-%>` instead of `=%>` for right-trimming. The `=%>` syntax is obscure and not well-supported in most ERB engines.")

    assertOffenses(dedent`
      <%= first =%>
      <%= second =%>
      <%= third =%>
    `)
  })

  test("when mixed valid and invalid syntax is used", () => {
    expectError("Use `-%>` instead of `=%>` for right-trimming. The `=%>` syntax is obscure and not well-supported in most ERB engines.")
    expectError("Use `-%>` instead of `=%>` for right-trimming. The `=%>` syntax is obscure and not well-supported in most ERB engines.")

    assertOffenses(dedent`
      <%= valid %>
      <%= invalid_trim =%>
      <%= valid_trim -%>
      <%= another_invalid =%>
    `)
  })

  test("when silent ERB uses =%>", () => {
    expectError("Use `-%>` instead of `=%>` for right-trimming. The `=%>` syntax is obscure and not well-supported in most ERB engines.")

    assertOffenses(dedent`
      <% silent_operation =%>
    `)
  })

  test("handles =%> in nested structures", () => {
    expectError("Use `-%>` instead of `=%>` for right-trimming. The `=%>` syntax is obscure and not well-supported in most ERB engines.")
    expectError("Use `-%>` instead of `=%>` for right-trimming. The `=%>` syntax is obscure and not well-supported in most ERB engines.")

    assertOffenses(dedent`
      <% if outer_condition =%>
        <% if inner_condition =%>
          <p>Nested content</p>
        <% end %>
      <% end %>
    `)
  })

  test("<%- with -%>", () => {
    expectNoOffenses(dedent`
      <%- something -%>
    `)
  })

  test("<%- with -%> in if/end", () => {
    expectNoOffenses(dedent`
      <%- if true -%>
        Something
      <%- end -%>
    `)
  })

  test("passes for yield with -%>", () => {
    expectNoOffenses(dedent`
      <%= yield -%>
    `)
  })

  test("passes for block with -%>", () => {
    expectNoOffenses(dedent`
      <%= content_for :content do -%>
        Content
      <%- end -%>
    `)
  })
})
