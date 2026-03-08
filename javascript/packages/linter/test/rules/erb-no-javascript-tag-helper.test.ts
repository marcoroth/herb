import dedent from "dedent"

import { describe, test } from "vitest"

import { ERBNoJavascriptTagHelperRule } from "../../src/rules/erb-no-javascript-tag-helper.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectWarning, assertOffenses } = createLinterTest(ERBNoJavascriptTagHelperRule)

describe("ERBNoJavascriptTagHelperRule", () => {
  test("javascript_tag helper is not allowed", () => {
    expectWarning("Avoid `javascript_tag`. Use inline `<script>` tags instead.")

    assertOffenses(dedent`
      <%= javascript_tag do %>
        if (a < 1) { <%= unsafe %> }
      <% end %>
    `)
  })

  test("inline script tag is allowed", () => {
    expectNoOffenses(dedent`
      <script>
        if (a < 1) { alert("hello") }
      </script>
    `)
  })
})
