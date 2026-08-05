import dedent from "dedent"

import { describe, test } from "vitest"

import { ERBNoStatementInScriptRule } from "../../src/rules/erb-no-statement-in-script.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectWarning, assertOffenses } = createLinterTest(ERBNoStatementInScriptRule)

describe("ERBNoStatementInScriptRule", () => {
  describe("not allowed", () => {
    test("ERB silent tag in script tag with type is not allowed", () => {
      expectWarning("Avoid `<% %>` tags inside `<script>`. Use `<%= %>` to interpolate values into JavaScript.")

      assertOffenses(dedent`
        <script type="text/javascript">
          <% if foo? %>
            bla
          <% end %>
        </script>
      `)
    })

    test("ERB silent tag in script without specified type is not allowed", () => {
      expectWarning("Avoid `<% %>` tags inside `<script>`. Use `<%= %>` to interpolate values into JavaScript.")

      assertOffenses(dedent`
        <script>
          <% if foo? %>
            bla
          <% end %>
        </script>
      `)
    })
  })

  describe("allowed", () => {
    test("ERB end statement in script tag is allowed", () => {
      expectNoOffenses(dedent`
        <script type="text/template">
          <%= ui_form do %>
            <div></div>
          <% end %>
        </script>
      `)
    })

    test("ERB comments in script tags are allowed", () => {
      expectNoOffenses(dedent`
        <script type="text/javascript">
          <%# comment %>
        </script>
      `)
    })

    test("ERB silent tag in script type text/html is allowed", () => {
      expectNoOffenses(dedent`
        <script type="text/html">
          <% if condition %>
            <p>Content</p>
          <% end %>
        </script>
      `)
    })

    test("statement after script tag is allowed", () => {
      expectNoOffenses(dedent`
        <script type="text/javascript">
          foo()
        </script>
        <% if condition? %>
        <% end %>
      `)
    })

    test("script tag without content is allowed", () => {
      expectNoOffenses(dedent`
        <script type="text/javascript"></script>
      `)
    })
  })
})
