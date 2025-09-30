import dedent from "dedent"
import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../../src/linter.js"

import { ERBRightTrimRule } from "../../src/rules/erb-right-trim.js"

describe("ERBRightTrimRule", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("when the erb tag close with %>", () => {
    const html = dedent`
      <h1>
        <%= title %>
      </h1>
    `
    const linter = new Linter(Herb, [ERBRightTrimRule])
    const lintResult = linter.lint(html)

    expect(lintResult.offenses).toHaveLength(0)
  })

  test("when the erb tag close with -%>", () => {
    const html = dedent`
      <h1>
        <%= title -%>
      </h1>
    `
    const linter = new Linter(Herb, [ERBRightTrimRule])
    const lintResult = linter.lint(html)

    expect(lintResult.offenses).toHaveLength(0)
  })

  test("when the erb tag close with =%>", () => {
    const html = dedent`
      <h1>
        <%= title =%>
    `
    const linter = new Linter(Herb, [ERBRightTrimRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(1)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(1)
    expect(lintResult.offenses[0].code).toBe("erb-right-trim")
    expect(lintResult.offenses[0].message).toBe("Prefer -%> instead of =%> for trimming on the right")
  })
})
