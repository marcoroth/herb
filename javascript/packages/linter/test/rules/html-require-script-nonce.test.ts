import dedent from "dedent"
import { describe, test } from "vitest"
import { HTMLRequireScriptNonceRule } from "../../src/rules/html-require-script-nonce.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(HTMLRequireScriptNonceRule)

describe("html-require-script-nonce", () => {
  describe("HTML script tags", () => {
    test("passes when nonce attribute is present with a value", () => {
      expectNoOffenses('<script nonce="abc123"></script>')
    })

    test("passes when nonce attribute is present with ERB value", () => {
      expectNoOffenses('<script nonce="<%= request.content_security_policy_nonce %>"></script>')
    })

    test("fails when nonce attribute is missing", () => {
      expectError("Missing a `nonce` attribute on `<script>` tag. Use `request.content_security_policy_nonce`.")

      assertOffenses("<script></script>")
    })

    test("fails when nonce attribute has no value", () => {
      expectError("Missing a `nonce` attribute on `<script>` tag. Use `request.content_security_policy_nonce`.")

      assertOffenses("<script nonce></script>")
    })

    test("fails when type is text/javascript and nonce is missing", () => {
      expectError("Missing a `nonce` attribute on `<script>` tag. Use `request.content_security_policy_nonce`.")

      assertOffenses('<script type="text/javascript"></script>')
    })

    test("fails when type is application/javascript and nonce is missing", () => {
      expectError("Missing a `nonce` attribute on `<script>` tag. Use `request.content_security_policy_nonce`.")

      assertOffenses('<script type="application/javascript"></script>')
    })

    test("passes when type is text/javascript and nonce is present", () => {
      expectNoOffenses('<script type="text/javascript" nonce="abc123"></script>')
    })

    test("passes when type is application/javascript and nonce is present", () => {
      expectNoOffenses('<script type="application/javascript" nonce="abc123"></script>')
    })

    test("passes when type is not JavaScript", () => {
      expectNoOffenses('<script type="application/json"></script>')
    })

    test("passes when type is application/ld+json", () => {
      expectNoOffenses('<script type="application/ld+json">{"@context": "https://schema.org"}</script>')
    })

    test("ignores non-script tags", () => {
      expectNoOffenses('<div nonce="abc123"></div>')
    })
  })

  describe("ERB javascript helpers", () => {
    test("fails when javascript_tag is used without nonce", () => {
      expectError("Missing a `nonce` attribute on `<script>` tag. Use `request.content_security_policy_nonce`.")

      assertOffenses(dedent`
        <%= javascript_tag %>
      `)
    })

    test("fails when javascript_include_tag is used without nonce", () => {
      expectError("Missing a `nonce` attribute on `<script>` tag. Use `request.content_security_policy_nonce`.")

      assertOffenses(dedent`
        <%= javascript_include_tag "script" %>
      `)
    })

    test("passes when javascript_tag is used with nonce", () => {
      expectNoOffenses(dedent`
        <%= javascript_tag nonce: true %>
      `)
    })

    test("passes when javascript_include_tag is used with nonce", () => {
      expectNoOffenses(dedent`
        <%= javascript_include_tag "script", nonce: true %>
      `)
    })

  })

  describe("tag.script helper", () => {
    test("fails when tag.script is used without nonce", () => {
      expectError("Missing a `nonce` attribute on `<script>` tag. Use `request.content_security_policy_nonce`.")

      assertOffenses(dedent`
        <%= tag.script %>
      `)
    })

    test("warns when tag.script is used with nonce: true", () => {
      expectError(
        '`nonce: true` on `tag.script` outputs a literal `nonce="true"` attribute, which will not match the Content Security Policy header and the browser will block the script. Only `javascript_tag` and `javascript_include_tag` resolve `nonce: true` to the per-request `content_security_policy_nonce`. Use `javascript_tag` with `nonce: true` instead.'
      )

      assertOffenses(dedent`
        <%= tag.script nonce: true %>
      `)
    })
  })

  describe("literal nonce warnings for tag helpers", () => {
    test("warns when content_tag :script uses nonce: true", () => {
      expectError(
        '`nonce: true` on `content_tag` outputs a literal `nonce="true"` attribute, which will not match the Content Security Policy header and the browser will block the script. Only `javascript_tag` and `javascript_include_tag` resolve `nonce: true` to the per-request `content_security_policy_nonce`. Use `javascript_tag` with `nonce: true` instead.'
      )

      assertOffenses(dedent`
        <%= content_tag(:script, "alert(1)", nonce: true) %>
      `)
    })

    test("warns when content_tag :script uses nonce: false", () => {
      expectError(
        '`nonce: false` on `content_tag` outputs a literal `nonce="false"` attribute, which will not match the Content Security Policy header and the browser will block the script. Only `javascript_tag` and `javascript_include_tag` resolve `nonce: true` to the per-request `content_security_policy_nonce`. Use `javascript_tag` with `nonce: true` instead.'
      )

      assertOffenses(dedent`
        <%= content_tag(:script, "alert(1)", nonce: false) %>
      `)
    })

    test("warns when tag.script uses nonce: true", () => {
      expectError(
        '`nonce: true` on `tag.script` outputs a literal `nonce="true"` attribute, which will not match the Content Security Policy header and the browser will block the script. Only `javascript_tag` and `javascript_include_tag` resolve `nonce: true` to the per-request `content_security_policy_nonce`. Use `javascript_tag` with `nonce: true` instead.'
      )

      assertOffenses(dedent`
        <%= tag.script(nonce: true) { "alert(1)".html_safe } %>
      `)
    })

    test("warns when tag.script uses nonce: false", () => {
      expectError(
        '`nonce: false` on `tag.script` outputs a literal `nonce="false"` attribute, which will not match the Content Security Policy header and the browser will block the script. Only `javascript_tag` and `javascript_include_tag` resolve `nonce: true` to the per-request `content_security_policy_nonce`. Use `javascript_tag` with `nonce: true` instead.'
      )

      assertOffenses(dedent`
        <%= tag.script(nonce: false) { "alert(1)".html_safe } %>
      `)
    })

    test("does not warn when javascript_include_tag uses nonce: true", () => {
      expectNoOffenses(dedent`
        <%= javascript_include_tag "application", nonce: true %>
      `)
    })

    test("does not warn when javascript_tag uses nonce: true", () => {
      expectNoOffenses(dedent`
        <%= javascript_tag nonce: true do %>
          alert('Hello')
        <% end %>
      `)
    })
  })

  test("passes using unrelated content_tag", () => {
    expectNoOffenses(dedent`
      <%= content_tag :div, "hello", nonce: true %>
    `)
  })
})
