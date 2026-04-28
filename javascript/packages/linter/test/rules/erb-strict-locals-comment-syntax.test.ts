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

  test("allows i18n method calls with parentheses as default values", () => {
    expectNoOffenses(`<%# locals: (title: t("translation_key_for.title"), message:) %>`)
    expectNoOffenses(`<%# locals: (label: I18n.t("key"), value:) %>`)
    expectNoOffenses(`<%# locals: (a: foo(bar(baz())), b:) %>`)
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

  test("flags Ruby comment syntax for strict locals in execution tags", () => {
    expectError("Use `<%#` instead of `<% #` for strict locals comments. Only ERB comment syntax is recognized by Rails.")
    expectError("Use `<%#` instead of `<%- #` for strict locals comments. Only ERB comment syntax is recognized by Rails.")

    assertOffenses(dedent`
      <% # locals: (user:) %>
      <%- # locals: (admin: false) %>
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
