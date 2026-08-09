import { describe, it } from "vitest"
import { HTMLAriaRoleHeadingRequiresLevelRule } from "../../src/rules/html-aria-role-heading-requires-level.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectWarning, assertOffenses } = createLinterTest(HTMLAriaRoleHeadingRequiresLevelRule)

describe("html-aria-role-heading-requires-level", () => {
  it("allows a div with the proper heading", () => {
    expectNoOffenses('<div role="heading" aria-level="2">Section Title</div>')
  })

  it("fails when role=heading is used without aria-level", () => {
    expectWarning(`Element with \`role="heading"\` must have an \`aria-level\` attribute.`)

    assertOffenses('<div role="heading">Section Title</div>')
  })

  describe("ActionView tag helpers", () => {
    it("passes for tag.div with role heading and an aria-level", () => {
      expectNoOffenses('<%= tag.div role: "heading", aria: { level: 2 } %>')
    })

    it("fails for tag.div with role heading and no aria-level", () => {
      expectWarning("Element with `role=\"heading\"` must have an `aria-level` attribute.")

      assertOffenses('<%= tag.div role: "heading" %>')
    })

    it("fails for content_tag with role heading and no aria-level", () => {
      expectWarning("Element with `role=\"heading\"` must have an `aria-level` attribute.")

      assertOffenses('<%= content_tag :div, "Title", role: "heading" %>')
    })

    it("passes for role heading with a dynamic aria-level", () => {
      expectNoOffenses('<%= tag.div role: "heading", aria: { level: level } %>')
    })

    it("passes for role heading with an interpolated aria-level", () => {
      expectNoOffenses('<%= tag.div role: "heading", aria: { level: "#{level}" } %>')
    })

    // ActionView drops `aria-level` entirely when the value is nil, so this renders as a
    // heading with no level at all. The parser still emits the attribute node, so the rule
    // sees it as present and stays quiet.
    it.fails("fails for role heading with a nil aria-level, which ActionView omits entirely", () => {
      expectWarning("Element with `role=\"heading\"` must have an `aria-level` attribute.")

      assertOffenses('<%= tag.div role: "heading", aria: { level: nil } %>')
    })
  })
})
