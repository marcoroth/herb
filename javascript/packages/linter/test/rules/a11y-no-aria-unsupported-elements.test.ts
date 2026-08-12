import dedent from "dedent"
import { describe, test } from "vitest"

import { createLinterTest } from "../helpers/linter-test-helper.js"
import { A11yNoAriaUnsupportedElementsRule } from "../../src/rules/a11y-no-aria-unsupported-elements.js"

const { expectNoOffenses, expectWarning, assertOffenses } = createLinterTest(A11yNoAriaUnsupportedElementsRule)

describe("a11y-no-aria-unsupported-elements", () => {
  test("passes for meta without ARIA attributes", () => {
    expectNoOffenses('<meta charset="UTF-8" />')
  })

  test("passes for html with lang attribute", () => {
    expectNoOffenses('<html lang="en"></html>')
  })

  test("passes for script without ARIA attributes", () => {
    expectNoOffenses('<script></script>')
  })

  test("passes for style without ARIA attributes", () => {
    expectNoOffenses('<style></style>')
  })

  test("passes for div with ARIA attributes", () => {
    expectNoOffenses('<div aria-hidden="true"></div>')
  })

  test("passes for button with role", () => {
    expectNoOffenses('<button role="tab"></button>')
  })

  test("fails for meta with aria-hidden", () => {
    expectWarning('The `aria-hidden` attribute is not supported on the `<meta>` element. ARIA roles, states, and properties should not be used on elements that are not visible or not interactive.')

    assertOffenses('<meta charset="UTF-8" aria-hidden="false" />')
  })

  test("fails for html with role", () => {
    expectWarning('The `role` attribute is not supported on the `<html>` element. ARIA roles, states, and properties should not be used on elements that are not visible or not interactive.')

    assertOffenses('<html lang="en" role="application"></html>')
  })

  test("fails for script with aria-hidden", () => {
    expectWarning('The `aria-hidden` attribute is not supported on the `<script>` element. ARIA roles, states, and properties should not be used on elements that are not visible or not interactive.')

    assertOffenses('<script aria-hidden="false"></script>')
  })

  test("fails for style with aria-label", () => {
    expectWarning('The `aria-label` attribute is not supported on the `<style>` element. ARIA roles, states, and properties should not be used on elements that are not visible or not interactive.')

    assertOffenses('<style aria-label="styles"></style>')
  })

  test("fails for multiple ARIA attributes on unsupported element", () => {
    expectWarning('The `aria-hidden` attribute is not supported on the `<meta>` element. ARIA roles, states, and properties should not be used on elements that are not visible or not interactive.')
    expectWarning('The `aria-label` attribute is not supported on the `<meta>` element. ARIA roles, states, and properties should not be used on elements that are not visible or not interactive.')

    assertOffenses('<meta aria-hidden="true" aria-label="test" />')
  })

  describe("javascript_tag helper", () => {
    test("fails for javascript_tag with aria-hidden", () => {
      expectWarning('The `aria-hidden` attribute is not supported on the `<script>` element. ARIA roles, states, and properties should not be used on elements that are not visible or not interactive.')

      assertOffenses(dedent`
        <%= javascript_tag aria_hidden: "true" do %>
          alert("hello")
        <% end %>`
      )
    })

    test("fails for javascript_tag with role", () => {
      expectWarning('The `role` attribute is not supported on the `<script>` element. ARIA roles, states, and properties should not be used on elements that are not visible or not interactive.')

      assertOffenses(dedent`
        <%= javascript_tag role: "application" do %>
          alert("hello")
        <% end %>`
      )
    })

    test("passes for javascript_tag without ARIA attributes", () => {
      expectNoOffenses(dedent`
        <%= javascript_tag nonce: true do %>
          alert("hello")
        <% end %>`
      )
    })
  })
})
