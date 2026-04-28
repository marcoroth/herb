import dedent from "dedent"
import { describe, test } from "vitest"
import { ActionViewStrictLocalsFirstLineRule } from "../../src/rules/actionview-strict-locals-first-line.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(ActionViewStrictLocalsFirstLineRule, { enabled: true })

describe("ActionViewStrictLocalsFirstLineRule", () => {
  test("allows strict locals on line 1 followed by a blank line", () => {
    expectNoOffenses(dedent`
      <%# locals: (user:) %>

      <div><%= user.name %></div>
    `, { fileName: "_partial.html.erb" })
  })

  test("allows strict locals on line 1 with no content after", () => {
    expectNoOffenses(`<%# locals: (user:) %>`, { fileName: "_partial.html.erb" })
    expectNoOffenses(`<%# locals: (user:) %>\n`, { fileName: "_partial.html.erb" })
  })

  test("flags strict locals not on the first line", () => {
    expectError("Strict locals declaration must be on the first line of the partial.")

    assertOffenses(dedent`
      <div class="card">
        <%# locals: (user:) %>
        <%= user.name %>
      </div>
    `, { fileName: "_card.html.erb" })
  })

  test("flags strict locals after a leading blank line", () => {
    expectError("Strict locals declaration must be on the first line of the partial.")

    assertOffenses(`\n<%# locals: (user:) %>`, { fileName: "_partial.html.erb" })
  })

  test("flags strict locals after other content", () => {
    expectError("Strict locals declaration must be on the first line of the partial.")

    assertOffenses(dedent`
      <%# This is a comment %>
      <%# locals: (user:) %>
    `, { fileName: "_partial.html.erb" })
  })

  test("flags strict locals on line 1 without a blank line before content", () => {
    expectError("Add a blank line after the strict locals declaration.")

    assertOffenses(dedent`
      <%# locals: (user:) %>
      <div><%= user.name %></div>
    `, { fileName: "_partial.html.erb" })
  })

  test("flags strict locals on line 1 without a blank line before an ERB tag", () => {
    expectError("Add a blank line after the strict locals declaration.")

    assertOffenses(dedent`
      <%# locals: (message:) %>
      <%= message %>
    `, { fileName: "_partial.html.erb" })
  })

  test("does not flag non-partial files", () => {
    expectNoOffenses(dedent`
      <div class="card">
        <%# locals: (user:) %>
      </div>
    `, { fileName: "show.html.erb" })
  })

  test("does not flag when no strict locals declaration", () => {
    expectNoOffenses(dedent`
      <div><%= user.name %></div>
    `, { fileName: "_partial.html.erb" })
  })

  test("does not flag when filename is not provided", () => {
    expectNoOffenses(`<%# locals: (user:) %>`, { fileName: undefined })
  })

  test("allows strict locals with whitespace trimming marker on line 1 with blank line", () => {
    expectNoOffenses(dedent`
      <%# locals: (user:) -%>

      <div><%= user.name %></div>
    `, { fileName: "_partial.html.erb" })
  })

  test("flags strict locals inside an HTML element", () => {
    expectError("Strict locals declaration must be on the first line of the partial.")

    assertOffenses(dedent`
      <div>
        <%# locals: (user:) %>
        <%= user.name %>
      </div>
    `, { fileName: "_partial.html.erb" })
  })
})
