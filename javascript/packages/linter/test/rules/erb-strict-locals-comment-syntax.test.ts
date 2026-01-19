import dedent from "dedent"
import { describe, test } from "vitest"
import { ERBStrictLocalsCommentSyntaxRule } from "../../src/rules/erb-strict-locals-comment-syntax.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(ERBStrictLocalsCommentSyntaxRule)

describe("ERBStrictLocalsCommentSyntaxRule", () => {
  test("allows valid strict locals comments", () => {
    expectNoOffenses(dedent`
      <%# locals: (user:, admin: false) %>
      <p><%= user.name %></p>
    `)

    expectNoOffenses(dedent`
      <%# locals: (title:) %>
      <h1><%= title %></h1>
    `)
  })

  test("allows empty locals", () => {
    expectNoOffenses(dedent`
      <%# locals: () %>
    `)
  })

  test("allows complex default values", () => {
    expectNoOffenses(`<%# locals: (items: [], config: {}) %>`)
    expectNoOffenses(`<%# locals: (name: "default", count: 0) %>`)
    expectNoOffenses(`<%# locals: (callback: -> { nil }) %>`)
  })

  test("allows double-splat for optional keyword arguments", () => {
    expectNoOffenses(`<%# locals: (message: "Hello", **attributes) %>`)
    expectNoOffenses(`<%# locals: (**options) %>`)
  })

  test("ignores non-locals comments", () => {
    expectNoOffenses(dedent`
      <%# just a regular comment %>
    `)
  })

  test("ignores regular Ruby comments in execution tags", () => {
    expectNoOffenses(dedent`
      <% # this is just a regular comment %>
      <% # nothing to see here %>
    `)
  })

  test("flags locals() without colon", () => {
    expectError("Use `locals:` with a colon, not `locals()`. Correct format: `<%# locals: (...) %>`.")

    assertOffenses(dedent`
      <%# locals() %>
    `)
  })

  test("flags local: (singular) instead of locals:", () => {
    expectError("Use `locals:` (plural), not `local:`.")

    assertOffenses(dedent`
      <%# local: (user:) %>
    `)
  })

  test("flags missing colon before parentheses", () => {
    expectError("Use `locals:` with a colon before the parentheses, not `locals (`.")

    assertOffenses(dedent`
      <%# locals (user:) %>
    `)
  })

  test("flags missing space after colon", () => {
    expectError("Missing space after `locals:`. Rails Strict Locals require a space after the colon: `<%# locals: (...) %>`.")

    assertOffenses(dedent`
      <%# locals:() %>
    `)
  })

  test("flags missing space after colon with locals", () => {
    expectError("Missing space after `locals:`. Rails Strict Locals require a space after the colon: `<%# locals: (...) %>`.")

    assertOffenses(dedent`
      <%# locals:(title:) %>
    `)
  })

  test("flags missing parentheses around parameters", () => {
    expectError("Wrap parameters in parentheses: `locals: (name:)` or `locals: (name: default)`.")

    assertOffenses(dedent`
      <%# locals: user %>
    `)
  })

  test("flags empty locals: without parentheses", () => {
    expectError("Add parameters after `locals:`. Use `locals: (name:)` or `locals: ()` for no locals.")

    assertOffenses(dedent`
      <%# locals: %>
    `)
  })

  test("flags unbalanced parentheses", () => {
    expectError("Unbalanced parentheses in `locals:` comment. Ensure all opening parentheses have matching closing parentheses.")

    assertOffenses(dedent`
      <%# locals: (user: %>
    `)
  })

  test("flags Ruby comment syntax for strict locals in execution tags", () => {
    expectError("Use `<%#` instead of `<% #` for strict locals comments. Only ERB comment syntax is recognized by Rails.")
    expectError("Use `<%#` instead of `<%- #` for strict locals comments. Only ERB comment syntax is recognized by Rails.")

    assertOffenses(dedent`
      <% # locals: (user:) %>
      <%- # locals: (admin: false) %>
    `)
  })

  test("flags positional arguments (not supported)", () => {
    expectError("Positional argument `user` is not allowed. Use keyword argument format: `user:`.")

    assertOffenses(dedent`
      <%# locals: (user) %>
    `)
  })

  test("flags block arguments (not supported)", () => {
    expectError("Block argument `&block` is not allowed. Strict locals only support keyword arguments.")

    assertOffenses(dedent`
      <%# locals: (&block) %>
    `)
  })

  test("flags single splat arguments (not supported)", () => {
    expectError("Splat argument `*args` is not allowed. Strict locals only support keyword arguments.")

    assertOffenses(dedent`
      <%# locals: (*args) %>
    `)
  })

  test("flags trailing comma in parameters", () => {
    expectError("Unexpected comma in `locals:` parameters.")

    assertOffenses(dedent`
      <%# locals: (user:,) %>
    `)
  })

  test("flags leading comma in parameters", () => {
    expectError("Unexpected comma in `locals:` parameters.")

    assertOffenses(dedent`
      <%# locals: (, user:) %>
    `)
  })

  test("flags double commas in parameters", () => {
    expectError("Unexpected comma in `locals:` parameters.")

    assertOffenses(dedent`
      <%# locals: (user:,, admin:) %>
    `)
  })

  test("flags duplicate strict locals comments", () => {
    expectError("Duplicate `locals:` declaration. Only one `locals:` comment is allowed per partial (first declaration at line 1).")

    assertOffenses(dedent`
      <%# locals: (user:) %>
      <p>Content</p>
      <%# locals: (admin:) %>
    `)
  })

  test("allows single strict locals comment anywhere in partial", () => {
    expectNoOffenses(dedent`
      <p>Some content before</p>
      <%# locals: (user:) %>
      <p>Content after</p>
    `)
  })

  test("allows strict locals in partial files (filename starts with _)", () => {
    expectNoOffenses(`<%# locals: (user:) %>`, { fileName: "app/views/users/_user.html.erb" })
    expectNoOffenses(`<%# locals: (user:) %>`, { fileName: "_partial.html.erb" })
  })

  test("warns when strict locals used in non-partial files", () => {
    expectError("Strict locals (`locals:`) only work in partials (files starting with `_`). This declaration will be ignored.")

    assertOffenses(`<%# locals: (user:) %>`, { fileName: "app/views/users/show.html.erb" })
  })

  test("warns when strict locals used in layout files", () => {
    expectError("Strict locals (`locals:`) only work in partials (files starting with `_`). This declaration will be ignored.")

    assertOffenses(`<%# locals: (user:) %>`, { fileName: "app/views/layouts/application.html.erb" })
  })

  test("does not warn when filename is not provided (unknown context)", () => {
    expectNoOffenses(`<%# locals: (user:) %>`, { fileName: undefined })
  })
})
