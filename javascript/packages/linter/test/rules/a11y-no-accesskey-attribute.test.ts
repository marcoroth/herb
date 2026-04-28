import { describe, test } from "vitest"
import { A11yNoAccesskeyAttributeRule } from "../../src/rules/a11y-no-accesskey-attribute.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectWarning, assertOffenses } = createLinterTest(A11yNoAccesskeyAttributeRule)

describe("a11y-no-accesskey-attribute", () => {
  test("passes for element without accesskey", () => {
    expectNoOffenses('<div></div>')
  })

  test("passes for element with other attributes", () => {
    expectNoOffenses('<div class="main" id="app"></div>')
  })

  test("fails for element with accesskey", () => {
    expectWarning("Avoid using the `accesskey` attribute. Inconsistencies between keyboard shortcuts and keyboard commands used by screen readers and keyboard-only users create accessibility complications.")

    assertOffenses('<div accesskey="h"></div>')
  })

  test("fails for anchor with accesskey", () => {
    expectWarning("Avoid using the `accesskey` attribute. Inconsistencies between keyboard shortcuts and keyboard commands used by screen readers and keyboard-only users create accessibility complications.")

    assertOffenses('<a href="/about" accesskey="a">About</a>')
  })

  test("fails for button with accesskey", () => {
    expectWarning("Avoid using the `accesskey` attribute. Inconsistencies between keyboard shortcuts and keyboard commands used by screen readers and keyboard-only users create accessibility complications.")

    assertOffenses('<button accesskey="s">Submit</button>')
  })

  test("fails for input with accesskey", () => {
    expectWarning("Avoid using the `accesskey` attribute. Inconsistencies between keyboard shortcuts and keyboard commands used by screen readers and keyboard-only users create accessibility complications.")

    assertOffenses('<input accesskey="n" />')
  })

  test("fails for accesskey with boolean attribute (no value)", () => {
    expectWarning("Avoid using the `accesskey` attribute. Inconsistencies between keyboard shortcuts and keyboard commands used by screen readers and keyboard-only users create accessibility complications.")

    assertOffenses('<div accesskey></div>')
  })

  test("fails for accesskey with ERB value", () => {
    expectWarning("Avoid using the `accesskey` attribute. Inconsistencies between keyboard shortcuts and keyboard commands used by screen readers and keyboard-only users create accessibility complications.")

    assertOffenses('<div accesskey="<%= key %>"></div>')
  })

  describe("Action View helpers", () => {
    test("passes for link_to without accesskey", () => {
      expectNoOffenses('<%= link_to "About", "/about", class: "link" %>')
    })

    test("fails for link_to with accesskey", () => {
      expectWarning("Avoid using the `accesskey` attribute. Inconsistencies between keyboard shortcuts and keyboard commands used by screen readers and keyboard-only users create accessibility complications.")

      assertOffenses('<%= link_to "About", "/about", accesskey: "a" %>')
    })

    test("passes for tag.div without accesskey", () => {
      expectNoOffenses('<%= tag.div class: "container" %>')
    })

    test("fails for tag.div with accesskey", () => {
      expectWarning("Avoid using the `accesskey` attribute. Inconsistencies between keyboard shortcuts and keyboard commands used by screen readers and keyboard-only users create accessibility complications.")

      assertOffenses('<%= tag.div accesskey: "h" %>')
    })

    test("passes for content_tag without accesskey", () => {
      expectNoOffenses('<%= content_tag :div, "content", class: "main" %>')
    })

    test("fails for content_tag with accesskey", () => {
      expectWarning("Avoid using the `accesskey` attribute. Inconsistencies between keyboard shortcuts and keyboard commands used by screen readers and keyboard-only users create accessibility complications.")

      assertOffenses('<%= content_tag :div, "content", accesskey: "h" %>')
    })
  })
})
