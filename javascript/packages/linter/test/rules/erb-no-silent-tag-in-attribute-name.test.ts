import dedent from "dedent"

import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../../src/linter.js"

import { ERBNoSilentTagInAttributeNameRule } from "../../src/rules/erb-no-silent-tag-in-attribute-name.js"

describe("ERBNoSilentTagInAttributeNameRule", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("valid attributes with output ERB tags", () => {
    const html = dedent`
      <div data-<%= key %>-target="value"></div>
      <div <%= data_attributes_for(user) %>></div>
      <input data-<%= user.id %>-field="text">
    `

    const linter = new Linter(Herb, [ERBNoSilentTagInAttributeNameRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(0)
  })

  test("valid static attribute names", () => {
    const html = dedent`
      <div class="container"></div>
      <img src="/logo.png" alt="Logo">
      <input type="text" data-target="value">
    `
    const linter = new Linter(Herb, [ERBNoSilentTagInAttributeNameRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(0)
  })

  test("valid conditional attributes with ERB control flow", () => {
    const html = dedent`
      <div <% if valid? %>data-valid="true"<% else %>data-valid="false"<% end %>></div>
      <span <% if user.admin? %>class="admin"<% end %>></span>
      <input <% unless disabled %>enabled="true"<% end %>>
    `
    const linter = new Linter(Herb, [ERBNoSilentTagInAttributeNameRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(0)
  })

  test("invalid attribute with silent ERB tag", () => {
    const html = dedent`
      <div data-<% key %>-target="value"></div>
    `
    const linter = new Linter(Herb, [ERBNoSilentTagInAttributeNameRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(1)
    expect(lintResult.offenses[0].code).toBe("erb-no-silent-tag-in-attribute-name")
    expect(lintResult.offenses[0].message).toBe("Remove silent ERB tag from HTML attribute name. Silent ERB tags (`<%`) do not output content and should not be used in attribute names.")
  })

  test("invalid attribute with trimming silent ERB tag", () => {
    const html = dedent`
      <div data-<%- key -%>-id="thing"></div>
    `
    const linter = new Linter(Herb, [ERBNoSilentTagInAttributeNameRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(1)
    expect(lintResult.offenses[0].code).toBe("erb-no-silent-tag-in-attribute-name")
    expect(lintResult.offenses[0].message).toBe("Remove silent ERB tag from HTML attribute name. Silent ERB tags (`<%-`) do not output content and should not be used in attribute names.")
  })

  test("invalid attribute with comment ERB tag", () => {
    const html = dedent`
      <div data-<%# comment %>-target="value"></div>
    `
    const linter = new Linter(Herb, [ERBNoSilentTagInAttributeNameRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(1)
    expect(lintResult.offenses[0].code).toBe("erb-no-silent-tag-in-attribute-name")
    expect(lintResult.offenses[0].message).toBe("Remove silent ERB tag from HTML attribute name. Silent ERB tags (`<%#`) do not output content and should not be used in attribute names.")
  })

  test("multiple invalid attributes in same element", () => {
    const html = dedent`
      <div data-<% key %>-target="value" id-<% another %>-suffix="test"></div>
    `
    const linter = new Linter(Herb, [ERBNoSilentTagInAttributeNameRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(2)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(2)
    expect(lintResult.offenses[0].message).toBe("Remove silent ERB tag from HTML attribute name. Silent ERB tags (`<%`) do not output content and should not be used in attribute names.")
    expect(lintResult.offenses[1].message).toBe("Remove silent ERB tag from HTML attribute name. Silent ERB tags (`<%`) do not output content and should not be used in attribute names.")
  })

  test("mixed valid and invalid ERB tags in different attributes", () => {
    const html = dedent`
      <div
        data-<%= valid_key %>-target="value"
        prefix-<% invalid_key %>-id="test"
        class="<%= valid_class %>"
      ></div>
    `
    const linter = new Linter(Herb, [ERBNoSilentTagInAttributeNameRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(1)
    expect(lintResult.offenses[0].code).toBe("erb-no-silent-tag-in-attribute-name")
    expect(lintResult.offenses[0].message).toBe("Remove silent ERB tag from HTML attribute name. Silent ERB tags (`<%`) do not output content and should not be used in attribute names.")
  })

  test("nested HTML elements with various ERB patterns", () => {
    const html = dedent`
      <form>
        <input data-<%= user.id %>-field="text">
        <button data-<% collection %>-list="options"></button>
        <select prefix-<%# comment %>-suffix="value"></select>
      </form>
    `
    const linter = new Linter(Herb, [ERBNoSilentTagInAttributeNameRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(2)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(2)

    expect(lintResult.offenses[0].message).toBe("Remove silent ERB tag from HTML attribute name. Silent ERB tags (`<%`) do not output content and should not be used in attribute names.")
    expect(lintResult.offenses[1].message).toBe("Remove silent ERB tag from HTML attribute name. Silent ERB tags (`<%#`) do not output content and should not be used in attribute names.")
  })
})
