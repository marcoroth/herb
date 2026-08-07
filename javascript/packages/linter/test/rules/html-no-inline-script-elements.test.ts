import dedent from "dedent"
import { describe, test } from "vitest"

import { HTMLNoInlineScriptElementsRule } from "../../src/rules/html-no-inline-script-elements.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(HTMLNoInlineScriptElementsRule)

describe("html-no-inline-script-elements", () => {
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
    expectError("Avoid inline `<script>` tags. Extract the JavaScript into a separate `.js` file and deliver it through your framework's asset pipeline.")

    assertOffenses(dedent`
      <script src="https://example.com/app.js">
        alert("hello")
      </script>
    `)
  })

  test("fails with empty inline script tag", () => {
    expectError("Avoid inline `<script>` tags. Extract the JavaScript into a separate `.js` file and deliver it through your framework's asset pipeline.")

    assertOffenses("<script></script>")
  })

  test("fails with inline script tag", () => {
    expectError("Avoid inline `<script>` tags. Extract the JavaScript into a separate `.js` file and deliver it through your framework's asset pipeline.")

    assertOffenses("<script>alert('hello')</script>")
  })

  test("fails with script tag with unallowed type", () => {
    expectError("Avoid inline `<script>` tags. Extract the JavaScript into a separate `.js` file and deliver it through your framework's asset pipeline.")

    assertOffenses(dedent`
      <script type="text/javascript">alert("hello")</script>
    `)
  })

  test("suggests an external JavaScript file for a non-Action View framework", () => {
    expectError("Avoid inline `<script>` tags. Extract the JavaScript into a separate `.js` file and deliver it through your framework's asset pipeline.")

    assertOffenses("<script>alert('hello')</script>", { framework: "hanami" })
  })

  describe("ActionView tag helpers", () => {
    test("ignores javascript_tag", () => {
      expectNoOffenses(dedent`
        <%= javascript_tag do %>
          alert("hello")
        <% end %>
      `, { framework: "actionview" })
    })

    test("ignores javascript_include_tag", () => {
      expectNoOffenses(dedent`
        <%= javascript_include_tag "application" %>
      `, { framework: "actionview" })
    })

    test("suggests javascript_include_tag for an inline script tag", () => {
      expectError("Avoid inline `<script>` tags. Extract the JavaScript into a separate `.js` file and include it with `javascript_include_tag`.")

      assertOffenses("<script>alert('hello')</script>", { framework: "actionview" })
    })

    test("fails with tag.script helper", () => {
      expectError("Avoid inline `<script>` tags. Extract the JavaScript into a separate `.js` file and include it with `javascript_include_tag`.")

      assertOffenses(dedent`
        <%= tag.script %>
      `, { framework: "actionview" })
    })

    test("fails with content_tag :script helper", () => {
      expectError("Avoid inline `<script>` tags. Extract the JavaScript into a separate `.js` file and include it with `javascript_include_tag`.")

      assertOffenses(dedent`
        <%= content_tag(:script, "alert(1)") %>
      `, { framework: "actionview" })
    })
  })
})
