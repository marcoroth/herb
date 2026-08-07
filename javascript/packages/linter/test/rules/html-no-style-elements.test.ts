import dedent from "dedent"
import { describe, test } from "vitest"

import { HTMLNoStyleElementsRule } from "../../src/rules/html-no-style-elements.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(HTMLNoStyleElementsRule)

describe("html-no-style-elements", () => {
  describe("inline style tags", () => {
    test("fails with empty style tag", () => {
      expectError("Avoid inline `<style>` tags. Use `stylesheet_link_tag` to include external stylesheets instead.")

      assertOffenses("<style></style>")
    })

    test("fails with style tag", () => {
      expectError("Avoid inline `<style>` tags. Use `stylesheet_link_tag` to include external stylesheets instead.")

      assertOffenses(dedent`
        <style>
          .danger { color: red; }
        </style>
      `)
    })

    test("fails with style tag containing ERB comment", () => {
      expectError("Avoid inline `<style>` tags. Use `stylesheet_link_tag` to include external stylesheets instead.")

      assertOffenses(dedent`
        <style>
          <%# preflight %>
        </style>
      `)
    })
  })

  describe("action view helpers", () => {
    test("passes with stylesheet_link_tag", () => {
      expectNoOffenses(dedent`
        <%= stylesheet_link_tag "application" %>
      `)
    })

    test("fails with content_tag helper", () => {
      expectError("Avoid inline `<style>` tags. Use `stylesheet_link_tag` to include external stylesheets instead.")

      assertOffenses(dedent`
        <%= content_tag :style do %>
          .danger { color: red; }
        <% end %>
      `)
    })

    test("fails with tag helper", () => {
      expectError("Avoid inline `<style>` tags. Use `stylesheet_link_tag` to include external stylesheets instead.")

      assertOffenses(dedent`
        <%= tag.style do %>
          .danger { color: red; }
        <% end %>
      `)
    })
  })
})
