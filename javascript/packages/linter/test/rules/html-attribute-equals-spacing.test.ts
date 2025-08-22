import dedent from "dedent"

import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../../src/linter.js"

import { HTMLAttributeEqualsSpacingRule } from "../../src/rules/html-attribute-equals-spacing.js"

describe("HTMLAttributeEqualsSpacingRule", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("valid attributes with no spacing around equals", () => {
    const html = dedent`
      <div class="container"></div>
      <img src="/logo.png" alt="Logo">
      <input type="text" value="<%= @value %>">
    `
    const linter = new Linter(Herb, [HTMLAttributeEqualsSpacingRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(0)
  })

  test("attribute with space before equals", () => {
    const html = dedent`
      <div class ="container"></div>
    `
    const linter = new Linter(Herb, [HTMLAttributeEqualsSpacingRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(1)

    expect(lintResult.offenses[0].code).toBe("html-attribute-equals-spacing")
    expect(lintResult.offenses[0].message).toBe("Remove whitespace before `=` in HTML attribute")
  })

  test("attribute with space after equals", () => {
    const html = dedent`
      <img src= "/logo.png">
    `
    const linter = new Linter(Herb, [HTMLAttributeEqualsSpacingRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(1)

    expect(lintResult.offenses[0].code).toBe("html-attribute-equals-spacing")
    expect(lintResult.offenses[0].message).toBe("Remove whitespace after `=` in HTML attribute")
  })

  test("attribute with spaces both before and after equals", () => {
    const html = dedent`
      <input type = "text">
    `
    const linter = new Linter(Herb, [HTMLAttributeEqualsSpacingRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(2)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(2)

    expect(lintResult.offenses[0].message).toBe("Remove whitespace before `=` in HTML attribute")
    expect(lintResult.offenses[1].message).toBe("Remove whitespace after `=` in HTML attribute")
  })

  test("attribute value without quotes and spaces after equals", () => {
    const html = dedent`
      <div class=  data></div>
    `
    const linter = new Linter(Herb, [HTMLAttributeEqualsSpacingRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(1)

    expect(lintResult.offenses[0].message).toBe("Remove whitespace after `=` in HTML attribute")
  })

  test("attribute with static and dynamic ERB before equals", () => {
    const html = dedent`
      <div data-<%= key %>  ="value"></div>
    `
    const linter = new Linter(Herb, [HTMLAttributeEqualsSpacingRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(1)

    expect(lintResult.offenses[0].message).toBe("Remove whitespace before `=` in HTML attribute")
  })

  test("attribute with ERB before equals", () => {
    const html = dedent`
      <div <%= key %>  ="value"></div>
    `
    const linter = new Linter(Herb, [HTMLAttributeEqualsSpacingRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(1)

    expect(lintResult.offenses[0].message).toBe("Remove whitespace before `=` in HTML attribute")
  })

  test("attribute with static, dynamic ERB, static before equals", () => {
    const html = dedent`
      <div data-<%= key %>-user  ="value"></div>
    `
    const linter = new Linter(Herb, [HTMLAttributeEqualsSpacingRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(1)

    expect(lintResult.offenses[0].message).toBe("Remove whitespace before `=` in HTML attribute")
  })

  test("attribute value with ERB and spaces after equals", () => {
    const html = dedent`
      <div class=   <%= key %>></div>
    `
    const linter = new Linter(Herb, [HTMLAttributeEqualsSpacingRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(1)

    expect(lintResult.offenses[0].message).toBe("Remove whitespace after `=` in HTML attribute")
  })

  test("attribute with static, dynamic ERB, static after equals", () => {
    const html = dedent`
      <div class=  "data-<%= key %>-user  "></div>
    `
    const linter = new Linter(Herb, [HTMLAttributeEqualsSpacingRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(1)

    expect(lintResult.offenses[0].message).toBe("Remove whitespace after `=` in HTML attribute")
  })

  test("multiple attributes with various spacing issues", () => {
    const html = dedent`
      <div class ="container" id= "main" data-value = "test"></div>
    `
    const linter = new Linter(Herb, [HTMLAttributeEqualsSpacingRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(4)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(4)
  })

  test("attributes without values should not trigger rule", () => {
    const html = dedent`
      <input disabled required>
    `
    const linter = new Linter(Herb, [HTMLAttributeEqualsSpacingRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(0)
  })
})
