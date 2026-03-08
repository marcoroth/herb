import dedent from "dedent"

import { describe, test } from "vitest"

import { ERBNoUnsafeScriptInterpolationRule } from "../../src/rules/erb-no-unsafe-script-interpolation.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(ERBNoUnsafeScriptInterpolationRule)

const MESSAGE = "Unsafe ERB output in `<script>` tag. Use `.to_json` to safely serialize values into JavaScript."

describe("ERBNoUnsafeScriptInterpolationRule", () => {
  describe("unsafe", () => {
    test("ERB output in script tag without .to_json is not allowed", () => {
      expectError(MESSAGE)

      assertOffenses(dedent`
        <script>
          if (a < 1) { <%= unsafe %> }
        </script>
      `)
    })

    test("ERB output in script tag with type text/javascript is not allowed", () => {
      expectError(MESSAGE)

      assertOffenses(dedent`
        <script type="text/javascript">
          if (a < 1) { <%= unsafe %> }
        </script>
      `)
    })

    test("string literal in script tag without method call is not allowed", () => {
      expectError(MESSAGE)

      assertOffenses(dedent`
        <script type="text/javascript">
          if (a < 1) { <%= "unsafe" %> }
        </script>
      `)
    })

    test("html_safe without to_json in script tag is not allowed", () => {
      expectError(MESSAGE)

      assertOffenses(dedent`
        <script><%= @feature.html_safe %></script>
      `)
    })
  })

  describe("safe", () => {
    test("ERB output in script tag with .to_json is allowed", () => {
      expectNoOffenses(dedent`
        <script type="text/javascript">
          <%= unsafe.to_json %>
        </script>
      `)
    })

    test("raw with to_json in script tag is allowed", () => {
      expectNoOffenses(dedent`
        <script type="text/javascript">
          <%= raw unsafe.to_json %>
        </script>
      `)
    })

    test("raw() with to_json in script tag is allowed", () => {
      expectNoOffenses(dedent`
        <script>var myData = <%= raw(foo.to_json) %>;</script>
      `)
    })

    test("<%== with to_json in script tag is allowed", () => {
      expectNoOffenses(dedent`
        <script>var myData = <%== foo.to_json %>;</script>
      `)
    })

    test("html_safe with to_json in script tag is allowed", () => {
      expectNoOffenses(dedent`
        <script>var myData = <%= foo.to_json.html_safe %>;</script>
      `)
    })

    test("script tag with non-executable content type is ignored", () => {
      expectNoOffenses(dedent`
        <script type="text/html">
          <a onclick="<%= unsafe %>">
        </script>
      `)
    })

    test("multi line erb comments in script are allowed", () => {
      expectNoOffenses(dedent`
        <script>
          <%#
             this is a nice comment
             !@#$%?&*()
          %>
        </script>
      `)
    })
  })
})
