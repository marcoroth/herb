import { describe, it, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../../src/linter.js"
import { HTMLAriaRoleHeadingRequiresLevelRule } from "../../src/rules/html-aria-role-heading-requires-level.js"

describe("html-aria-role-heading-requires-level", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  it("allows a div with the proper heading", () => {
    const html = '<div role="heading" aria-level="2">Section Title</div>'
    const result = Herb.parse(html)
    const linter = new Linter([HTMLAriaRoleHeadingRequiresLevelRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(0)
  })

  it("fails when role=heading is used without aria-level", () => {
    const html = '<div role="heading">Section Title</div>'

    const result = Herb.parse(html)
    const linter = new Linter([HTMLAriaRoleHeadingRequiresLevelRule])
    const lintResult = linter.lint(result.value)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(1)
  })

  it("should show a correct error message ", () => {
    const html = '<div role="heading">Section Title</div>'
    const result = Herb.parse(html)
    const linter = new Linter([HTMLAriaRoleHeadingRequiresLevelRule])
    const lintResult = linter.lint(result.value)
    expect(lintResult.offenses[0].message).toBe(
      `Element with role="heading" must have an aria-level attribute. Example: <div role="heading" aria-level="2">.`
    )
  })
})
