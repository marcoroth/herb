import dedent from "dedent"
import { describe, test } from "vitest"

import { HTMLNoStyleElementsRule } from "../../src/rules/html-no-style-elements.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(HTMLNoStyleElementsRule)

describe("html-no-style-elements", () => {
  describe("inline style tags", () => {
    test("fails with empty style tag", () => {
      expectError("Avoid inline `<style>` tags. Extract the CSS into a separate `.css` file and deliver it through your framework's asset pipeline.")

      assertOffenses("<style></style>")
    })

    test("fails with style tag", () => {
      expectError("Avoid inline `<style>` tags. Extract the CSS into a separate `.css` file and deliver it through your framework's asset pipeline.")

      assertOffenses(dedent`
        <style>
          .danger { color: red; }
        </style>
      `)
    })

    test("fails with style tag containing ERB comment", () => {
      expectError("Avoid inline `<style>` tags. Extract the CSS into a separate `.css` file and deliver it through your framework's asset pipeline.")

      assertOffenses(dedent`
        <style>
          <%# preflight %>
        </style>
      `)
    })

    test("suggests an external stylesheet for a non-Action View framework", () => {
      expectError("Avoid inline `<style>` tags. Extract the CSS into a separate `.css` file and deliver it through your framework's asset pipeline.")

      assertOffenses("<style></style>", { framework: "hanami" })
    })
  })

  describe("action view helpers", () => {
    test("passes with stylesheet_link_tag", () => {
      expectNoOffenses(dedent`
        <%= stylesheet_link_tag "application" %>
      `, { framework: "actionview" })
    })

    test("suggests stylesheet_link_tag for a style tag", () => {
      expectError("Avoid inline `<style>` tags. Extract the CSS into a separate `.css` file and include it with `stylesheet_link_tag`.")

      assertOffenses("<style></style>", { framework: "actionview" })
    })

    test("fails with content_tag helper", () => {
      expectError("Avoid inline `<style>` tags. Extract the CSS into a separate `.css` file and include it with `stylesheet_link_tag`.")

      assertOffenses(dedent`
        <%= content_tag :style do %>
          .danger { color: red; }
        <% end %>
      `, { framework: "actionview" })
    })

    test("fails with tag helper", () => {
      expectError("Avoid inline `<style>` tags. Extract the CSS into a separate `.css` file and include it with `stylesheet_link_tag`.")

      assertOffenses(dedent`
        <%= tag.style do %>
          .danger { color: red; }
        <% end %>
      `, { framework: "actionview" })
    })
  })
})
