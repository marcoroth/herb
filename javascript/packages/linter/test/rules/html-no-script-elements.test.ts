import dedent from "dedent"
import { describe, test } from "vitest"

import { HTMLNoScriptElementsRule } from "../../src/rules/html-no-script-elements.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectWarning, assertOffenses } = createLinterTest(HTMLNoScriptElementsRule)

describe("html-no-script-elements", () => {
  test("passes with script tag with allowed type", () => {
    expectNoOffenses(dedent`
      <script type="application/json">{"key": "value"}</script>
    `)
  })

  test("passes with script tag with external src", () => {
    expectNoOffenses(dedent`
      <script src="https://npm.org/1.0.0/herb.min.js"></script>
    `)
  })

  test("passes with script tag with external src from ERB", () => {
    expectNoOffenses(dedent`
      <script src="<%= ENV["JS_URL"] %>" async></script>
    `)
  })

  test("fails with script tag with src and inline body", () => {
    expectWarning("Avoid inline `<script>` tags. Use `javascript_include_tag` to include external JavaScript files instead.")

    assertOffenses(dedent`
      <script src="https://example.com/app.js">
        alert("hello")
      </script>
    `)
  })

  test("fails with empty inline script tag", () => {
    expectWarning("Avoid inline `<script>` tags. Use `javascript_include_tag` to include external JavaScript files instead.")

    assertOffenses("<script></script>")
  })

  test("fails with inline script tag", () => {
    expectWarning("Avoid inline `<script>` tags. Use `javascript_include_tag` to include external JavaScript files instead.")

    assertOffenses("<script>alert('hello')</script>")
  })

  test("fails with script tag with unallowed type", () => {
    expectWarning("Avoid inline `<script>` tags. Use `javascript_include_tag` to include external JavaScript files instead.")

    assertOffenses(dedent`
      <script type="text/javascript">alert("hello")</script>
    `)
  })

  describe("ActionView tag helpers", () => {
    test("ignores javascript_tag", () => {
      expectNoOffenses(dedent`
        <%= javascript_tag do %>
          alert("hello")
        <% end %>
      `)
    })

    test("ignores javascript_include_tag", () => {
      expectNoOffenses(dedent`
        <%= javascript_include_tag "application" %>
      `)
    })

    test("fails with tag.script helper", () => {
      expectWarning("Avoid inline `<script>` tags. Use `javascript_include_tag` to include external JavaScript files instead.")

      assertOffenses(dedent`
        <%= tag.script %>
      `)
    })

    test("fails with content_tag :script helper", () => {
      expectWarning("Avoid inline `<script>` tags. Use `javascript_include_tag` to include external JavaScript files instead.")

      assertOffenses(dedent`
        <%= content_tag(:script, "alert(1)") %>
      `)
    })
  })
})
