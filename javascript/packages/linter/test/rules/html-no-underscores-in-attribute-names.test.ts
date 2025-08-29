import dedent from "dedent"

import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../../src"
import { HTMLNoUnderscoresInAttributeNamesRule } from "../../src"

describe("html-no-underscores-in-attribute-names", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("passes for valid attribute names (hyphens, letters, digits, colon)", () => {
    const html = dedent`
      <div data-user-id="123" aria-label="Close"></div>
      <input data123-value="ok">
    `

    const linter = new Linter(Herb, [HTMLNoUnderscoresInAttributeNamesRule])
    const lintResult = linter.lint(html)

    expect(lintResult.warnings).toBe(0)
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

    expect(lintResult.warnings).toBe(3)
    expect(lintResult.offenses).toHaveLength(3)

    expect(lintResult.offenses[0].rule).toBe("html-no-underscores-in-attribute-names")
    expect(lintResult.offenses[0].severity).toBe("warning")

    expect(lintResult.offenses[0].message).toBe("Attribute `data_user_id` should not contain underscores. Use hyphens (-) instead.")
    expect(lintResult.offenses[1].message).toBe("Attribute `aria_label` should not contain underscores. Use hyphens (-) instead.")
    expect(lintResult.offenses[2].message).toBe("Attribute `custom_attr` should not contain underscores. Use hyphens (-) instead.")
  })

  test("does not flag dynamic attribute names", () => {
    const html = dedent`
      <div data-<%=  %>="value"></div>
      <div <%= dynamic_name %>="value"></div>
      <div data-<%= key %>-test="value"></div>
    `

    const linter = new Linter(Herb, [HTMLNoUnderscoresInAttributeNamesRule])
    const lintResult = linter.lint(html)

    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(0)
  })

  test("fails for dynamic attribute names with underscores", () => {
    const html = dedent`
      <div data_<%= key %>="value"></div>
      <div data_<%= key %>-test="value"></div>
      <div data-<%= key %>_test="value"></div>
    `

    const linter = new Linter(Herb, [HTMLNoUnderscoresInAttributeNamesRule])
    const lintResult = linter.lint(html)

    expect(lintResult.warnings).toBe(3)
    expect(lintResult.offenses).toHaveLength(3)

    expect(lintResult.offenses[0].message).toBe("Attribute `data_<%= key %>` should not contain underscores. Use hyphens (-) instead.")
    expect(lintResult.offenses[1].message).toBe("Attribute `data_<%= key %>-test` should not contain underscores. Use hyphens (-) instead.")
    expect(lintResult.offenses[2].message).toBe("Attribute `data-<%= key %>_test` should not contain underscores. Use hyphens (-) instead.")
  })
})
