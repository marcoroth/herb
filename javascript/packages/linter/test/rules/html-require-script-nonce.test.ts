import dedent from "dedent"
import { describe, test } from "vitest"
import { HTMLRequireScriptNonceRule } from "../../src/rules/html-require-script-nonce.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(
  HTMLRequireScriptNonceRule,
)

const ACTIONVIEW_CONTEXT = { framework: "actionview" }
const GENERIC_MISSING_NONCE_MESSAGE =
  "Missing a `nonce` attribute on `<script>` tag. Use a dynamically generated nonce."
const ACTIONVIEW_MISSING_NONCE_MESSAGE =
  "Missing a `nonce` attribute on `<script>` tag. Use `request.content_security_policy_nonce`."

describe("html-require-script-nonce", () => {
  describe("HTML script tags", () => {
    test("passes when nonce attribute is present with a value", () => {
      expectNoOffenses('<script nonce="abc123"></script>')
    })

    test("passes when nonce attribute is present with ERB value", () => {
      expectNoOffenses(
        '<script nonce="<%= request.content_security_policy_nonce %>"></script>',
      )
    })

    test.each([
      ["an unspecified framework", undefined, GENERIC_MISSING_NONCE_MESSAGE],
      ["Ruby", { framework: "ruby" }, GENERIC_MISSING_NONCE_MESSAGE],
      ["Hanami", { framework: "hanami" }, GENERIC_MISSING_NONCE_MESSAGE],
      ["Sinatra", { framework: "sinatra" }, GENERIC_MISSING_NONCE_MESSAGE],
      ["Action View", ACTIONVIEW_CONTEXT, ACTIONVIEW_MISSING_NONCE_MESSAGE],
    ])("uses the appropriate recommendation for %s", (_, context, message) => {
      expectError(message)

      assertOffenses("<script></script>", context ? { context } : undefined)
    })

    test("fails when nonce attribute has no value", () => {
      expectError(GENERIC_MISSING_NONCE_MESSAGE)

      assertOffenses("<script nonce></script>")
    })

    test("fails when type is text/javascript and nonce is missing", () => {
      expectError(GENERIC_MISSING_NONCE_MESSAGE)

      assertOffenses('<script type="text/javascript"></script>')
    })

    test("fails when type is application/javascript and nonce is missing", () => {
      expectError(GENERIC_MISSING_NONCE_MESSAGE)

      assertOffenses('<script type="application/javascript"></script>')
    })

    test.each([
      '<script src="/application.js"></script>',
      "<script src></script>",
      '<script src=""></script>',
      '<script src="<%= asset_path %>"></script>',
      '<script SRC="/application.js"></script>',
      '<script src="/application.js">alert("hello")</script>',
    ])("passes external script %s", (script) => {
      expectNoOffenses(script)
    })

    test("passes when type is text/javascript and nonce is present", () => {
      expectNoOffenses(
        '<script type="text/javascript" nonce="abc123"></script>',
      )
    })

    test("passes when type is application/javascript and nonce is present", () => {
      expectNoOffenses(
        '<script type="application/javascript" nonce="abc123"></script>',
      )
    })

    test("passes when type is not JavaScript", () => {
      expectNoOffenses('<script type="application/json"></script>')
    })

    test("passes when type is application/ld+json", () => {
      expectNoOffenses(
        '<script type="application/ld+json">{"@context": "https://schema.org"}</script>',
      )
    })

    test("ignores non-script tags", () => {
      expectNoOffenses('<div nonce="abc123"></div>')
    })
  })

  describe("ERB javascript helpers", () => {
    test("fails when javascript_tag is used without nonce", () => {
      expectError(ACTIONVIEW_MISSING_NONCE_MESSAGE)

      assertOffenses(
        dedent`
        <%= javascript_tag %>
      `,
        { context: ACTIONVIEW_CONTEXT },
      )
    })

    test("passes when javascript_include_tag is used without nonce", () => {
      expectNoOffenses(
        dedent`
        <%= javascript_include_tag "script" %>
      `,
        { context: ACTIONVIEW_CONTEXT },
      )
    })

    test("passes when javascript_tag is used with nonce", () => {
      expectNoOffenses(
        dedent`
        <%= javascript_tag nonce: true %>
      `,
        { context: ACTIONVIEW_CONTEXT },
      )
    })

    test("passes when javascript_include_tag is used with nonce", () => {
      expectNoOffenses(
        dedent`
        <%= javascript_include_tag "script", nonce: true %>
      `,
        { context: ACTIONVIEW_CONTEXT },
      )
    })
  })

  describe("tag.script helper", () => {
    test("fails when tag.script is used without nonce", () => {
      expectError(ACTIONVIEW_MISSING_NONCE_MESSAGE)

      assertOffenses(
        dedent`
        <%= tag.script %>
      `,
        { context: ACTIONVIEW_CONTEXT },
      )
    })

    test("warns when tag.script is used with nonce: true", () => {
      expectError(
        '`nonce: true` on `tag.script` outputs a literal `nonce="true"` attribute, which will not match the Content Security Policy header and the browser will block the script. Only `javascript_tag` and `javascript_include_tag` resolve `nonce: true` to the per-request `content_security_policy_nonce`. Use `javascript_tag` with `nonce: true` instead.',
      )

      assertOffenses(
        dedent`
        <%= tag.script nonce: true %>
      `,
        { context: ACTIONVIEW_CONTEXT },
      )
    })
  })

  describe("literal nonce warnings for tag helpers", () => {
    test("warns when content_tag :script uses nonce: true", () => {
      expectError(
        '`nonce: true` on `content_tag` outputs a literal `nonce="true"` attribute, which will not match the Content Security Policy header and the browser will block the script. Only `javascript_tag` and `javascript_include_tag` resolve `nonce: true` to the per-request `content_security_policy_nonce`. Use `javascript_tag` with `nonce: true` instead.',
      )

      assertOffenses(
        dedent`
        <%= content_tag(:script, "alert(1)", nonce: true) %>
      `,
        { context: ACTIONVIEW_CONTEXT },
      )
    })

    test("warns when content_tag :script uses nonce: false", () => {
      expectError(
        '`nonce: false` on `content_tag` outputs a literal `nonce="false"` attribute, which will not match the Content Security Policy header and the browser will block the script. Only `javascript_tag` and `javascript_include_tag` resolve `nonce: true` to the per-request `content_security_policy_nonce`. Use `javascript_tag` with `nonce: true` instead.',
      )

      assertOffenses(
        dedent`
        <%= content_tag(:script, "alert(1)", nonce: false) %>
      `,
        { context: ACTIONVIEW_CONTEXT },
      )
    })

    test("warns when tag.script uses nonce: true", () => {
      expectError(
        '`nonce: true` on `tag.script` outputs a literal `nonce="true"` attribute, which will not match the Content Security Policy header and the browser will block the script. Only `javascript_tag` and `javascript_include_tag` resolve `nonce: true` to the per-request `content_security_policy_nonce`. Use `javascript_tag` with `nonce: true` instead.',
      )

      assertOffenses(
        dedent`
        <%= tag.script(nonce: true) { "alert(1)".html_safe } %>
      `,
        { context: ACTIONVIEW_CONTEXT },
      )
    })

    test("warns when tag.script uses nonce: false", () => {
      expectError(
        '`nonce: false` on `tag.script` outputs a literal `nonce="false"` attribute, which will not match the Content Security Policy header and the browser will block the script. Only `javascript_tag` and `javascript_include_tag` resolve `nonce: true` to the per-request `content_security_policy_nonce`. Use `javascript_tag` with `nonce: true` instead.',
      )

      assertOffenses(
        dedent`
        <%= tag.script(nonce: false) { "alert(1)".html_safe } %>
      `,
        { context: ACTIONVIEW_CONTEXT },
      )
    })

    test("does not warn when javascript_include_tag uses nonce: true", () => {
      expectNoOffenses(
        dedent`
        <%= javascript_include_tag "application", nonce: true %>
      `,
        { context: ACTIONVIEW_CONTEXT },
      )
    })

    test("does not warn when javascript_tag uses nonce: true", () => {
      expectNoOffenses(
        dedent`
        <%= javascript_tag nonce: true do %>
          alert('Hello')
        <% end %>
      `,
        { context: ACTIONVIEW_CONTEXT },
      )
    })

    test.each([
      ["tag.script", "an unspecified framework", undefined],
      ["tag.script", "Ruby", { framework: "ruby" }],
      ["tag.script", "Hanami", { framework: "hanami" }],
      ["tag.script", "Sinatra", { framework: "sinatra" }],
      ["content_tag", "an unspecified framework", undefined],
      ["content_tag", "Ruby", { framework: "ruby" }],
      ["content_tag", "Hanami", { framework: "hanami" }],
      ["content_tag", "Sinatra", { framework: "sinatra" }],
    ])(
      "does not emit Rails-specific literal nonce diagnostics for %s in %s",
      (helper, _, context) => {
        const source =
          helper === "tag.script"
            ? "<%= tag.script nonce: true %>"
            : '<%= content_tag :script, "alert(1)", nonce: true %>'

        expectNoOffenses(source, context ? { context } : undefined)
      },
    )
  })

  test("passes using unrelated content_tag", () => {
    expectNoOffenses(dedent`
      <%= content_tag :div, "hello", nonce: true %>
    `)
  })
})
