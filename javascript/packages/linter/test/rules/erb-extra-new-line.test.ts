import dedent from "dedent"

import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../../src/linter.js"

import { ERBExtraNewLineRule } from "../../src/rules/erb-extra-new-line.js"

describe("ERBExtraNewLineRule", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("when no new line is present", () => {
    const html = dedent`
      line 1
    `
    const linter = new Linter(Herb, [ERBExtraNewLineRule])
    const lintResult = linter.lint(html)

    expect(lintResult.errors).toBe(0)
    expect(lintResult.warnings).toBe(0)
    expect(lintResult.offenses).toHaveLength(0)
  })

  test("when no blank lines are present", () => {
    const html = dedent`
      line 1
      line 2
      line 3
    `
    const linter = new Linter(Herb, [ERBExtraNewLineRule])
    const lintResult = linter.lint(html)

    expect(lintResult.offenses).toHaveLength(0)
  })

  test("when a single blank line is present", () => {
    const html = dedent`
      line 1

      line 3
    `
    const linter = new Linter(Herb, [ERBExtraNewLineRule])
    const lintResult = linter.lint(html)

    expect(lintResult.offenses).toHaveLength(0)
  })
  
  test("when two blank lines follow each other", () => {
    const html = dedent`
      line 1


      line 3
    `
    const linter = new Linter(Herb, [ERBExtraNewLineRule])
    const lintResult = linter.lint(html)

    expect(lintResult.offenses).toHaveLength(1)
    expect(lintResult.offenses[0].message).toBe("Extra blank line detected.")
  })

  test("when more than two newlines follow each other", () => {
    let html = dedent`
      line 1



      line 3
    `

    html += "line1".repeat(300_000)

    const linter = new Linter(Herb, [ERBExtraNewLineRule])
    const lintResult = linter.lint(html)

    expect(lintResult.offenses).toHaveLength(1)
    expect(lintResult.offenses[0].message).toBe("Extra blank line detected.")
  })
})
