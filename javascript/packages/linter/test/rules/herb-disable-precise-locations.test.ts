import dedent from "dedent"
import { describe, test, beforeAll, expect } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../../src/linter.js"

import { HerbDisableCommentValidRuleNameRule } from "../../src/rules/herb-disable-comment-valid-rule-name.js"
import { HerbDisableCommentNoRedundantAllRule } from "../../src/rules/herb-disable-comment-no-redundant-all.js"

describe("Herb Disable Comment Precise Locations", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("points to the exact unknown rule name", () => {
    const html = dedent`
      <div>test</div> <%# herb:disable unknown-rule %>
    `

    const linter = new Linter(Herb, [HerbDisableCommentValidRuleNameRule])
    const result = linter.lint(html)

    expect(result.offenses).toHaveLength(1)

    const offense = result.offenses[0]
    expect(offense.rule).toBe("herb-disable-comment-valid-rule-name")

    expect(offense.location.start.line).toBe(1)
    expect(offense.location.end.line).toBe(1)

    const columnRange = offense.location.end.column - offense.location.start.column
    expect(columnRange).toBe("unknown-rule".length)
  })

  test("points to first unknown rule in multiple rules", () => {
    const html = dedent`
      <div>test</div> <%# herb:disable html-tag-name-lowercase, invalid-rule, html-attribute-double-quotes %>
    `

    const linter = new Linter(Herb, [HerbDisableCommentValidRuleNameRule])
    const result = linter.lint(html)

    expect(result.offenses).toHaveLength(1)

    const offense = result.offenses[0]
    expect(offense.message).toContain("invalid-rule")

    const columnRange = offense.location.end.column - offense.location.start.column
    expect(columnRange).toBe("invalid-rule".length)
  })

  test("points to 'all' when used with specific rules", () => {
    const html = dedent`
      <div>test</div> <%# herb:disable html-tag-name-lowercase, all %>
    `

    const linter = new Linter(Herb, [HerbDisableCommentNoRedundantAllRule])
    const result = linter.lint(html)

    expect(result.offenses).toHaveLength(1)

    const offense = result.offenses[0]
    expect(offense.rule).toBe("herb-disable-comment-no-redundant-all")

    const columnRange = offense.location.end.column - offense.location.start.column
    expect(columnRange).toBe("all".length)
  })

  test("points to 'all' when it appears first", () => {
    const html = dedent`
      <div>test</div> <%# herb:disable all, html-tag-name-lowercase %>
    `

    const linter = new Linter(Herb, [HerbDisableCommentNoRedundantAllRule])
    const result = linter.lint(html)

    expect(result.offenses).toHaveLength(1)

    const offense = result.offenses[0]

    const columnRange = offense.location.end.column - offense.location.start.column
    expect(columnRange).toBe("all".length)
  })
})
