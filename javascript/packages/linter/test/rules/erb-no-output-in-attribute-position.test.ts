import dedent from "dedent"

import { describe, test } from "vitest"

import { ERBNoOutputInAttributePositionRule } from "../../src/rules/erb-no-output-in-attribute-position.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(ERBNoOutputInAttributePositionRule)

const MESSAGE = "Avoid `<%= %>` in attribute position. Use `<% if ... %>` with static attributes instead."
const CONDITIONAL_MESSAGE = "Avoid using conditional `tag.attributes` in attribute position. Use `<% if ... %><%= tag.attributes(...) %><% end %>` instead."

describe("ERBNoOutputInAttributePositionRule", () => {
  describe("not allowed", () => {
    test("ERB output tag in attribute position", () => {
      expectError(MESSAGE)

      assertOffenses(dedent`
        <div <%= data_attributes %>></div>
      `)
    })

    test("ERB raw output tag in attribute position", () => {
      expectError(MESSAGE)

      assertOffenses(dedent`
        <div <%== raw_attributes %>></div>
      `)
    })

    test("multiple ERB output tags in attribute position", () => {
      expectError(MESSAGE)
      expectError(MESSAGE)

      assertOffenses(dedent`
        <div <%= first_attrs %> <%= second_attrs %>></div>
      `)
    })

    test("tag.div in attribute position is not allowed", () => {
      expectError(MESSAGE)

      assertOffenses(dedent`
        <div <%= tag.div %>>Content</div>
      `)
    })

    test("tag.attributes with trailing non-tag.attributes expression is not allowed", () => {
      expectError(MESSAGE)

      assertOffenses(dedent`
        <div <%= tag.attributes(id: "main") && "extra" %>></div>
      `)
    })

    test("tag.attributes inside string interpolation is not allowed", () => {
      expectError(MESSAGE)

      assertOffenses(dedent`
        <div <%= "#{output} #{tag.attributes(id: "main")}" %>></div>
      `)
    })

    test("other tag helper in attribute position is not allowed", () => {
      expectError(MESSAGE)

      assertOffenses(dedent`
        <div <%= tag.attributes_for(:div) %>></div>
      `)
    })

    test("tag.attributes with inline if is not allowed", () => {
      expectError(CONDITIONAL_MESSAGE)

      assertOffenses(dedent`
        <div <%= tag.attributes(id: "main") if condition %>></div>
      `)
    })

    test("tag.attributes with inline unless is not allowed", () => {
      expectError(CONDITIONAL_MESSAGE)

      assertOffenses(dedent`
        <div <%= tag.attributes(id: "main") unless disabled %>></div>
      `)
    })

    test("tag.attributes with ternary is not allowed", () => {
      expectError(CONDITIONAL_MESSAGE)

      assertOffenses(dedent`
        <div <%= condition ? tag.attributes(id: "a") : tag.attributes(id: "b") %>></div>
      `)
    })

    test("tag.attributes with && operator is not allowed", () => {
      expectError(CONDITIONAL_MESSAGE)

      assertOffenses(dedent`
        <div <%= condition && tag.attributes(id: "main") %>></div>
      `)
    })

    test("tag.attributes with || operator is not allowed", () => {
      expectError(CONDITIONAL_MESSAGE)

      assertOffenses(dedent`
        <div <%= tag.attributes(id: "a") || tag.attributes(id: "b") %>></div>
      `)
    })
  })

  describe("allowed", () => {
    test("static attributes", () => {
      expectNoOffenses(dedent`
        <div class="container" id="main"></div>
        <img src="/logo.png" alt="Logo">
        <input type="text" name="field">
      `)
    })

    test("ERB output in attribute values", () => {
      expectNoOffenses(dedent`
        <div class="<%= css_class %>"></div>
        <input value="<%= user.name %>">
        <a href="<%= path %>">Link</a>
      `)
    })

    test("ERB control flow in attribute position", () => {
      expectNoOffenses(dedent`
        <div <% if active? %>class="active"<% end %>></div>
        <input <% unless disabled %>enabled<% end %>>
      `)
    })

    test("tag.attributes in attribute position", () => {
      expectNoOffenses(dedent`
        <input <%= tag.attributes(type: :text, aria: { label: "Search" }) %>>
      `)
    })

    test("tag.attributes mixed with HTML attributes", () => {
      expectNoOffenses(dedent`
        <button class="primary" <%= tag.attributes(id: "cta", aria: { expanded: false }) %>>Click</button>
      `)
    })
  })
})
