import dedent from "dedent"

import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../../src/linter.js"

import { HTMLNoUnderscoresInAttributeNamesRule } from "../../src/rules/html-no-underscores-in-attribute-names.js"

describe("html-no-underscores-in-attribute-names", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("passes for valid attribute names (hyphens, letters, digits, colon)", () => {
    const html = dedent`
      <div data-user-id="123" aria-label="Close"></div>
      <svg xmlns:xlink="http://www.w3.org/1999/xlink">
        <use xlink:href="#icon" />
      </svg>
      <input data123-value="ok">
    `

    const linter = new Linter(Herb, [HTMLNoUnderscoresInAttributeNamesRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.offenses).toHaveLength(0)
  })

  test("fails for attribute names with underscores", () => {
    const html = dedent`
      <div data_user_id="123"></div>
      <img aria_label="Close">
      <custom-element custom_attr="x"></custom-element>
    `

    const linter = new Linter(Herb, [HTMLNoUnderscoresInAttributeNamesRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(3)
    expect(lintResult.offenses).toHaveLength(3)

    expect(lintResult.offenses[0].rule).toBe("html-no-underscores-in-attribute-names")
    expect(lintResult.offenses[0].severity).toBe("error")

    expect(lintResult.offenses[0].message).toBe("HTML attribute name `data_user_id` should not contain underscores. Use hyphens (-) instead.")
    expect(lintResult.offenses[1].message).toBe("HTML attribute name `aria_label` should not contain underscores. Use hyphens (-) instead.")
    expect(lintResult.offenses[2].message).toBe("HTML attribute name `custom_attr` should not contain underscores. Use hyphens (-) instead.")
  })

  test("does not flag dynamic attribute names (ERB in name)", () => {
    const html = dedent`
      <div data-<%= key %>="value"></div>
      <div <%= dynamic_name %>="value"></div>
      <div data-<%= key %>-test="value"></div>
    `

    const linter = new Linter(Herb, [HTMLNoUnderscoresInAttributeNamesRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.offenses).toHaveLength(0)
  })
})
