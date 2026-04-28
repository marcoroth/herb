import dedent from "dedent"

import { describe, test } from "vitest"

import { ERBNoUnsafeRawRule } from "../../src/rules/erb-no-unsafe-raw.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(ERBNoUnsafeRawRule)

const RAW_MESSAGE = "Avoid `raw()` in ERB output. It bypasses HTML escaping and can cause cross-site scripting (XSS) vulnerabilities."
const HTML_SAFE_MESSAGE = "Avoid `.html_safe` in ERB output. It bypasses HTML escaping and can cause cross-site scripting (XSS) vulnerabilities."

describe("ERBNoUnsafeRawRule", () => {
  describe("raw()", () => {
    test("raw() in attribute value is not allowed", () => {
      expectError(RAW_MESSAGE)

      assertOffenses(dedent`
        <div class="<%= raw(user_input) %>"></div>
      `)
    })

    test("raw() in non-JS attribute is not allowed", () => {
      expectError(RAW_MESSAGE)

      assertOffenses(dedent`
        <a href="<%= raw unsafe %>">Link</a>
      `)
    })

    test("raw() in text content is not allowed", () => {
      expectError(RAW_MESSAGE)

      assertOffenses(dedent`
        <p><%= raw(user_input) %></p>
      `)
    })

    test("raw() in helper call is not allowed", () => {
      expectError(RAW_MESSAGE)

      assertOffenses(dedent`
        <%= ui_my_helper(:foo, help_text: raw("foo")) %>
      `)
    })

    // better-html: "using raw anywhere in html tags" - `<a "<%= raw("hello") %>">`
    // Our parser rejects this as invalid HTML (quotes without attribute name)
    test.fails("raw in html tag attribute position is not allowed", () => {
      expectError(RAW_MESSAGE)

      assertOffenses(dedent`
        <a "<%= raw(hello) %>">
      `)
    })
  })

  describe(".html_safe", () => {
    test("html_safe in attribute value is not allowed", () => {
      expectError(HTML_SAFE_MESSAGE)

      assertOffenses(dedent`
        <div class="<%= user_input.html_safe %>"></div>
      `)
    })

    test("html_safe in non-JS attribute is not allowed", () => {
      expectError(HTML_SAFE_MESSAGE)

      assertOffenses(dedent`
        <a href="<%= unsafe.html_safe %>">Link</a>
      `)
    })

    test("html_safe with to_json in JS attribute is still not allowed", () => {
      expectError(HTML_SAFE_MESSAGE)

      assertOffenses(dedent`
        <a onclick="method(<%= unsafe.to_json.html_safe %>)"></a>
      `)
    })

    test("html_safe in text content is not allowed", () => {
      expectError(HTML_SAFE_MESSAGE)

      assertOffenses(dedent`
        <p><%= user_input.html_safe %></p>
      `)
    })
  })

  describe("raw with to_json", () => {
    test("raw with to_json in attribute is still not allowed", () => {
      expectError(RAW_MESSAGE)

      assertOffenses(dedent`
        <a onclick="method(<%= raw unsafe.to_json %>)"></a>
      `)
    })

    test("raw in script tag is skipped (handled by erb-no-unsafe-script-interpolation)", () => {
      expectNoOffenses(dedent`
        <script>var myData = <%= raw(foo.to_json) %>;</script>
      `)
    })
  })

  describe("skipped in raw-text elements", () => {
    test("raw in script tag is skipped", () => {
      expectNoOffenses(dedent`
        <script><%= raw(unsafe) %></script>
      `)
    })

    test("html_safe in script tag is skipped", () => {
      expectNoOffenses(dedent`
        <script><%= foo.to_json.html_safe %></script>
      `)
    })

    test("raw in style tag is skipped", () => {
      expectNoOffenses(dedent`
        <style><%= raw(url) %></style>
      `)

      expectNoOffenses(dedent`
        <style>@import url(<%= raw url_for("all.css") %>);</style>
      `)
    })

    test("raw in textarea is skipped", () => {
      expectNoOffenses(dedent`
        <textarea><%= raw(content) %></textarea>
      `)
    })
  })

  describe("safe usage", () => {
    test("safe ERB output in attribute value is allowed", () => {
      expectNoOffenses(dedent`
        <div class="<%= user_input %>"></div>
      `)
    })

    test("safe ERB output in text content is allowed", () => {
      expectNoOffenses(dedent`
        <p><%= user_input %></p>
      `)
    })

    test("to_json without raw is allowed", () => {
      expectNoOffenses(dedent`
        <a onclick="method(<%= unsafe.to_json %>)"></a>
      `)
    })
  })
})
