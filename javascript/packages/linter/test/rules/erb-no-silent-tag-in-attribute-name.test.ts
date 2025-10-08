import dedent from "dedent"

import { describe, test } from "vitest"

import { ERBNoSilentTagInAttributeNameRule } from "../../src/rules/erb-no-silent-tag-in-attribute-name.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(ERBNoSilentTagInAttributeNameRule)

describe("ERBNoSilentTagInAttributeNameRule", () => {
  test("valid attributes with output ERB tags", () => {
    const html = dedent`
      <div data-<%= key %>-target="value"></div>
      <div <%= data_attributes_for(user) %>></div>
      <input data-<%= user.id %>-field="text">
    `

    expectNoOffenses(html)
  })

  test("valid static attribute names", () => {
    const html = dedent`
      <div class="container"></div>
      <img src="/logo.png" alt="Logo">
      <input type="text" data-target="value">
    `

    expectNoOffenses(html)
  })

  test("valid conditional attributes with ERB control flow", () => {
    const html = dedent`
      <div <% if valid? %>data-valid="true"<% else %>data-valid="false"<% end %>></div>
      <span <% if user.admin? %>class="admin"<% end %>></span>
      <input <% unless disabled %>enabled="true"<% end %>>
    `

    expectNoOffenses(html)
  })

  test("invalid attribute with silent ERB tag", () => {
    const html = dedent`
      <div data-<% key %>-target="value"></div>
    `

    expectError("Remove silent ERB tag from HTML attribute name. Silent ERB tags (`<%`) do not output content and should not be used in attribute names.")
    assertOffenses(html)
  })

  test("invalid attribute with trimming silent ERB tag", () => {
    const html = dedent`
      <div data-<%- key -%>-id="thing"></div>
    `

    expectError("Remove silent ERB tag from HTML attribute name. Silent ERB tags (`<%-`) do not output content and should not be used in attribute names.")
    assertOffenses(html)
  })

  test("invalid attribute with comment ERB tag", () => {
    const html = dedent`
      <div data-<%# comment %>-target="value"></div>
    `

    expectError("Remove silent ERB tag from HTML attribute name. Silent ERB tags (`<%#`) do not output content and should not be used in attribute names.")
    assertOffenses(html)
  })

  test("multiple invalid attributes in same element", () => {
    const html = dedent`
      <div data-<% key %>-target="value" id-<% another %>-suffix="test"></div>
    `

    expectError("Remove silent ERB tag from HTML attribute name. Silent ERB tags (`<%`) do not output content and should not be used in attribute names.")
    expectError("Remove silent ERB tag from HTML attribute name. Silent ERB tags (`<%`) do not output content and should not be used in attribute names.")
    assertOffenses(html)
  })

  test("mixed valid and invalid ERB tags in different attributes", () => {
    const html = dedent`
      <div
        data-<%= valid_key %>-target="value"
        prefix-<% invalid_key %>-id="test"
        class="<%= valid_class %>"
      ></div>
    `

    expectError("Remove silent ERB tag from HTML attribute name. Silent ERB tags (`<%`) do not output content and should not be used in attribute names.")
    assertOffenses(html)
  })

  test("nested HTML elements with various ERB patterns", () => {
    const html = dedent`
      <form>
        <input data-<%= user.id %>-field="text">
        <button data-<% collection %>-list="options"></button>
        <select prefix-<%# comment %>-suffix="value"></select>
      </form>
    `

    expectError("Remove silent ERB tag from HTML attribute name. Silent ERB tags (`<%`) do not output content and should not be used in attribute names.")
    expectError("Remove silent ERB tag from HTML attribute name. Silent ERB tags (`<%#`) do not output content and should not be used in attribute names.")
    assertOffenses(html)
  })
})
