import { describe, it } from "vitest"
import dedent from "dedent"

import { ActionViewNoUnnecessaryHTMLSafeRule } from "../../src/rules/actionview-no-unnecessary-html-safe"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(ActionViewNoUnnecessaryHTMLSafeRule)

describe("actionview-no-unnecessary-html-safe", () => {
  it("flags a String literal marked as HTML-safe in attribute position", () => {
    expectError('Avoid calling `.html_safe` on the String literal `\'style="display: none;"\'`. Write the content directly in the template instead.', { line: 1, column: 9 })

    assertOffenses(`<div <%= 'style="display: none;"'.html_safe %>></div>`)
  })

  it("flags a String literal marked as HTML-safe in content position", () => {
    expectError('Avoid calling `.html_safe` on the String literal `"<strong>Sale</strong>"`. Write the content directly in the template instead.')

    assertOffenses(`<p><%= "<strong>Sale</strong>".html_safe %></p>`)
  })

  it("flags a String literal with an HTML entity", () => {
    expectError('Avoid calling `.html_safe` on the String literal `"&copy; 2026"`. Write the content directly in the template instead.')

    assertOffenses(`<%= "&copy; 2026".html_safe %>`)
  })

  it("flags a single-quoted String literal", () => {
    expectError("Avoid calling `.html_safe` on the String literal `'Sale'`. Write the content directly in the template instead.")

    assertOffenses(`<%= 'Sale'.html_safe %>`)
  })

  it("flags a percent-literal String", () => {
    expectError("Avoid calling `.html_safe` on the String literal `%q(<b>Sale</b>)`. Write the content directly in the template instead.")

    assertOffenses(`<%= %q(<b>Sale</b>).html_safe %>`)
  })

  it("flags a call with explicit parentheses", () => {
    expectError('Avoid calling `.html_safe` on the String literal `"Sale"`. Write the content directly in the template instead.')

    assertOffenses(`<%= "Sale".html_safe() %>`)
  })

  it("flags a String literal in a raw output tag", () => {
    expectError('Avoid calling `.html_safe` on the String literal `"Sale"`. Write the content directly in the template instead.')

    assertOffenses(`<%== "Sale".html_safe %>`)
  })

  it("flags every occurrence in a template", () => {
    const html = dedent`
      <div <%= 'style="display: none;"'.html_safe %>>
        <p><%= "<strong>Sale</strong>".html_safe %></p>
      </div>
    `

    expectError('Avoid calling `.html_safe` on the String literal `\'style="display: none;"\'`. Write the content directly in the template instead.')
    expectError('Avoid calling `.html_safe` on the String literal `"<strong>Sale</strong>"`. Write the content directly in the template instead.')

    assertOffenses(html)
  })

  it("passes for `.html_safe` on a dynamic value", () => {
    expectNoOffenses(`<p><%= description.html_safe %></p>`)
  })

  it("passes for `.html_safe` on an interpolated String", () => {
    expectNoOffenses(`<p><%= "<strong>#{name}</strong>".html_safe %></p>`)
  })

  it("passes for `.html_safe` on a String literal with another call in between", () => {
    expectNoOffenses(`<p><%= "Sale".freeze.html_safe %></p>`)
  })

  it("passes when the result of `.html_safe` is used further", () => {
    expectNoOffenses(`<p><%= "Sale".html_safe.strip %></p>`)
  })

  it("passes when the String literal is an argument of a helper", () => {
    expectNoOffenses(`<p><%= link_to "Sale".html_safe, sale_path %></p>`)
  })

  it("passes for a String literal marked as HTML-safe in a silent tag", () => {
    expectNoOffenses(`<% "Sale".html_safe %>`)
  })

  it("passes for `raw` with a String literal", () => {
    expectNoOffenses(`<p><%= raw("<strong>Sale</strong>") %></p>`)
  })

  it("passes for a String literal without `.html_safe`", () => {
    expectNoOffenses(`<p><%= "Sale" %></p>`)
  })

  it("passes for plain HTML", () => {
    expectNoOffenses(`<div style="display: none;"></div>`)
  })
})
