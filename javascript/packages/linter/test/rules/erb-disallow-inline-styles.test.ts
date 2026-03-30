import dedent from "dedent"
import { describe, test } from "vitest"

import { ERBDisallowInlineStylesRule } from "../../src/rules/erb-disallow-inline-styles.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectWarning, assertOffenses } = createLinterTest(ERBDisallowInlineStylesRule)

describe("erb-disallow-inline-styles", () => {
  describe("inline style tags", () => {
    test("fails with empty style tag", () => {
      expectWarning("Avoid inline `<style>` tags. Use `stylesheet_link_tag` to include external stylesheets instead.")

      assertOffenses("<style></style>")
    })

    test("fails with style tag", () => {
      expectWarning("Avoid inline `<style>` tags. Use `stylesheet_link_tag` to include external stylesheets instead.")

      assertOffenses(dedent`
        <style>
          .danger { color: red; }
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
      expectWarning("Avoid inline `<style>` tags. Use `stylesheet_link_tag` to include external stylesheets instead.")

      assertOffenses(dedent`
        <%= content_tag :style do %>
          .danger { color: red; }
        <% end %>
      `)
    })

    test("fails with tag helper", () => {
      expectWarning("Avoid inline `<style>` tags. Use `stylesheet_link_tag` to include external stylesheets instead.")

      assertOffenses(dedent`
        <%= tag.style do %>
          .danger { color: red; }
        <% end %>
      `)
    })
  })

  describe("style attributes", () => {
    test("passes with class attribute", () => {
      expectNoOffenses(dedent`
        <button class="btn btn-primary">Submit</button>
      `)
    })

    test("passes with data attributes", () => {
      expectNoOffenses(dedent`
        <div data-controller="hello" data-action="click->hello#greet">Content</div>
      `)
    })

    test("fails with inline style attribute", () => {
      expectWarning("Avoid inline `style` attribute. Use an external stylesheet or CSS classes instead.")

      assertOffenses(dedent`
        <button style="color: red;">Submit</button>
      `)
    })

    test("fails with ERB tag in style attribute", () => {
      expectWarning("Avoid inline `style` attribute. Use an external stylesheet or CSS classes instead.")

      assertOffenses(dedent`
        <div style="<%= custom_styles %>">Content</div>
      `)
    })
  })
})
