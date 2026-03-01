import dedent from "dedent"
import { describe, test } from "vitest"
import { ERBStrictLocalsRequiredRule } from "../../src/rules/erb-strict-locals-required.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(ERBStrictLocalsRequiredRule, { enabled: true })

describe("ERBStrictLocalsRequiredRule", () => {
  test("allows partials with strict locals declaration", () => {
    expectNoOffenses(`<%# locals: (user:) %>`, { fileName: "_partial.html.erb" })
    expectNoOffenses(`<%# locals: (user:, admin: false) %>`, { fileName: "_card.html.erb" })
  })

  test("allows partials with empty strict locals declaration", () => {
    expectNoOffenses(`<%# locals: () %>`, { fileName: "_partial.html.erb" })
  })

  test("allows partials with strict locals and content", () => {
    expectNoOffenses(dedent`
      <%# locals: (title:) %>
      <h2><%= title %></h2>
    `, { fileName: "_heading.html.erb" })
  })

  test("allows strict locals anywhere in the file", () => {
    expectNoOffenses(dedent`
      <div class="card">
        <%# locals: (user:) %>
        <%= user.name %>
      </div>
    `, { fileName: "_card.html.erb" })
  })

  test("flags partials without strict locals declaration", () => {
    expectError("Partial is missing a strict locals declaration. Add `<%# locals: (...) %>` at the top of the file.")

    assertOffenses(dedent`
      <div class="user-card">
        <%= user.name %>
      </div>
    `, { fileName: "_user_card.html.erb" })
  })

  test("flags partials with only regular comments", () => {
    expectError("Partial is missing a strict locals declaration. Add `<%# locals: (...) %>` at the top of the file.")

    assertOffenses(dedent`
      <%# This is just a regular comment %>
      <p>Content</p>
    `, { fileName: "_partial.html.erb" })
  })

  test("does not flag non-partial files", () => {
    expectNoOffenses(dedent`
      <div class="user-card">
        <%= user.name %>
      </div>
    `, { fileName: "show.html.erb" })
  })

  test("does not flag layout files", () => {
    expectNoOffenses(dedent`
      <!DOCTYPE html>
      <html>
        <body><%= yield %></body>
      </html>
    `, { fileName: "application.html.erb" })
  })

  test("does not flag when filename is not provided", () => {
    expectNoOffenses(dedent`
      <div>Content</div>
    `, { fileName: undefined })
  })

  test("does not flag strict locals in Ruby comment syntax (wrong syntax)", () => {
    expectError("Partial is missing a strict locals declaration. Add `<%# locals: (...) %>` at the top of the file.")

    assertOffenses(dedent`
      <% # locals: (user:) %>
      <p>Content</p>
    `, { fileName: "_partial.html.erb" })
  })
})
