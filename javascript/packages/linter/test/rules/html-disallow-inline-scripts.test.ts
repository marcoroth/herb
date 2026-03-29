import dedent from "dedent"
import { describe, test } from "vitest"

import { HTMLDisallowInlineScriptsRule } from "../../src/rules/html-disallow-inline-scripts.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectWarning, assertOffenses } = createLinterTest(HTMLDisallowInlineScriptsRule)

describe("html-disallow-inline-scripts", () => {
  describe("inline script tags", () => {
    test("passes with script tag with allowed type", () => {
      expectNoOffenses(dedent`
        <script type="application/json">{"key": "value"}</script>
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
  })

  describe("event handler attributes", () => {
    test("passes with regular element attributes", () => {
      expectNoOffenses(dedent`
        <button class="btn" id="submit" type="submit">Click</button>
      `)
    })

    test("passes with data attributes", () => {
      expectNoOffenses(dedent`
        <div data-controller="hello" data-action="click->hello#greet">Content</div>
      `)
    })

    test("fails with disallowed event handler attribute", () => {
      expectWarning("Avoid inline event handler `onclick`. Use external JavaScript with `addEventListener` instead.")

      assertOffenses(dedent`
        <button onclick="doSomething()">Click</button>
      `)
    })

    test("fails with ERB output in event handler attribute", () => {
      expectWarning("Avoid inline event handler `onclick`. Use external JavaScript with `addEventListener` instead.")

      assertOffenses(dedent`
        <a onclick="<%= action %>">Link</a>
      `)
    })
  })
})
