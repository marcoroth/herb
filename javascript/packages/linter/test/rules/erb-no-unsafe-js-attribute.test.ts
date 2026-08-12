import dedent from "dedent"

import { describe, test } from "vitest"

import { ERBNoUnsafeJSAttributeRule } from "../../src/rules/erb-no-unsafe-js-attribute.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(ERBNoUnsafeJSAttributeRule)

describe("ERBNoUnsafeJSAttributeRule", () => {
  describe("unsafe", () => {
    test("ERB output in onclick without .to_json is not allowed", () => {
      expectError("Unsafe ERB output in `onclick` attribute. Use `.to_json`, `j()`, or `escape_javascript()` to safely encode values.")

      assertOffenses(dedent`
        <a onclick="method(<%= unsafe %>)"></a>
      `)
    })

    test("ERB output in onmouseover without .to_json is not allowed", () => {
      expectError("Unsafe ERB output in `onmouseover` attribute. Use `.to_json`, `j()`, or `escape_javascript()` to safely encode values.")

      assertOffenses(dedent`
        <div onmouseover="highlight('<%= element_id %>')"></div>
      `)
    })

    test.fails("ternary with unsafe JS escaping is not allowed", () => {
      expectError("Unsafe ERB output in `onclick` attribute. Use `.to_json`, `j()`, or `escape_javascript()` to safely encode values.")

      assertOffenses(dedent`
        <a onclick="method(<%= foo ? bar : j(baz) %>)"></a>
      `)
    })

    test("html_safe with to_json in JS attribute is still unsafe", () => {
      expectError("Unsafe ERB output in `onclick` attribute. Use `.to_json`, `j()`, or `escape_javascript()` to safely encode values.")

      assertOffenses(dedent`
        <a onclick="method(<%= unsafe.to_json.html_safe %>)"></a>
      `)
    })

    test("string with Ruby interpolation in JS attribute is not allowed", () => {
      expectError("Unsafe ERB output in `onclick` attribute. Use `.to_json`, `j()`, or `escape_javascript()` to safely encode values.")

      assertOffenses(dedent`
        <a onclick="<%= "hello \#{name}" %>"></a>
      `)
    })

    test("string with Ruby interpolation and ternary in JS attribute is not allowed", () => {
      expectError("Unsafe ERB output in `onclick` attribute. Use `.to_json`, `j()`, or `escape_javascript()` to safely encode values.")

      assertOffenses(dedent`
        <a onclick="<%= "hello \#{foo ? bar : baz}" if bla? %>"></a>
      `)
    })
  })

  describe("safe", () => {
    test.fails("static string in JS attribute is allowed", () => {
      expectNoOffenses(dedent`
        <a onclick="alert('<%= "something" %>')"></a>
      `)
    })

    test("ERB output in onclick with .to_json is allowed", () => {
      expectNoOffenses(dedent`
        <a onclick="method(<%= unsafe.to_json %>)"></a>
      `)
    })

    test("j() is safe in JS attribute", () => {
      expectNoOffenses(dedent`
        <a onclick="method('<%= j(unsafe) %>')"></a>
      `)
    })

    test("j without parens is safe in JS attribute", () => {
      expectNoOffenses(dedent`
        <a onclick="method('<%= j unsafe %>')"></a>
      `)
    })

    test("escape_javascript() is safe in JS attribute", () => {
      expectNoOffenses(dedent`
        <a onclick="method(<%= escape_javascript(unsafe) %>)"></a>
      `)
    })

    test("escape_javascript without parens is safe in JS attribute", () => {
      expectNoOffenses(dedent`
        <a onclick="method(<%= escape_javascript unsafe %>)"></a>
      `)
    })

    test("ternary with safe JS escaping is allowed", () => {
      expectNoOffenses(dedent`
        <a onclick="method(<%= foo ? bar.to_json : j(baz) %>)"></a>
      `)
    })

    test("non-JS attribute with ERB output is allowed", () => {
      expectNoOffenses(dedent`
        <div class="<%= css_class %>"></div>
      `)
    })
  })
})
