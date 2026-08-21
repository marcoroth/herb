import dedent from "dedent"

import { beforeAll, describe, test, expect } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { Config } from "@herb-tools/config"

import { Linter } from "../../src/linter.js"

import { HTMLTagNameLowercaseRule } from "../../src/rules/html-tag-name-lowercase.js"
import { HerbCounterCommentOutOfDateRule } from "../../src/rules/herb-counter-comment-out-of-date.js"
import { HerbCounterCommentUnnecessaryRule } from "../../src/rules/herb-counter-comment-unnecessary.js"

const target = "html-tag-name-lowercase"

const lintWith = (source: string, options: { ignoreCounterComments?: boolean } = {}) => {
  const config = Config.fromObject({
    linter: {
      rules: {
        [target]: { enabled: true, severity: "error" },
        "herb-counter-comment-out-of-date": { enabled: true, severity: "warning" },
        "herb-counter-comment-unnecessary": { enabled: true, severity: "warning" },
      },
    },
  })

  const linter = new Linter(
    Herb,
    [HTMLTagNameLowercaseRule, HerbCounterCommentOutOfDateRule, HerbCounterCommentUnnecessaryRule],
    config,
  )

  return linter.lint(source, options)
}

const offensesFor = (source: string, rule: string, options?: { ignoreCounterComments?: boolean }) =>
  lintWith(source, options).offenses.filter(offense => offense.rule === rule)

describe("counter suppression semantics", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("N == E suppresses every offense and reports no drift", () => {
    const source = dedent`
      <%# herb:counter html-tag-name-lowercase 2 %>
      <DIV></DIV>
      <SPAN></SPAN>
    `

    expect(offensesFor(source, target)).toHaveLength(0)
    expect(offensesFor(source, "herb-counter-comment-out-of-date")).toHaveLength(0)
    expect(offensesFor(source, "herb-counter-comment-unnecessary")).toHaveLength(0)
    expect(lintWith(source).counterSuppressed).toBe(2)
  })

  test("N > E reports every offense AND emits herb-counter-comment-out-of-date", () => {
    const source = dedent`
      <%# herb:counter html-tag-name-lowercase 1 %>
      <DIV></DIV>
      <SPAN></SPAN>
      <SECTION></SECTION>
    `

    expect(offensesFor(source, target)).toHaveLength(3)

    const drift = offensesFor(source, "herb-counter-comment-out-of-date")
    expect(drift).toHaveLength(1)
    expect(drift[0].message).toContain("expects 1 offense")
    expect(drift[0].message).toContain("found 3")
    expect(lintWith(source).counterSuppressed).toBe(0)
  })

  test("0 < N < E suppresses the offenses and emits herb-counter-comment-out-of-date", () => {
    const source = dedent`
      <%# herb:counter html-tag-name-lowercase 5 %>
      <DIV></DIV>
    `

    expect(offensesFor(source, target)).toHaveLength(0)

    const drift = offensesFor(source, "herb-counter-comment-out-of-date")
    expect(drift).toHaveLength(1)
    expect(drift[0].message).toContain("expects 5 offenses")
    expect(drift[0].message).toContain("found 1")
    expect(lintWith(source).counterSuppressed).toBe(1)
  })

  test("N == 0 emits herb-counter-comment-unnecessary and does not emit out-of-date", () => {
    const source = dedent`
      <%# herb:counter html-tag-name-lowercase 3 %>
      <div></div>
    `

    const unnecessary = offensesFor(source, "herb-counter-comment-unnecessary")
    expect(unnecessary).toHaveLength(1)
    expect(unnecessary[0].message).toContain("No offenses from `html-tag-name-lowercase`")

    expect(offensesFor(source, "herb-counter-comment-out-of-date")).toHaveLength(0)
  })

  test("N == 0 and E == 0 emits neither meta-rule", () => {
    const source = dedent`
      <%# herb:counter html-tag-name-lowercase 0 %>
      <div></div>
    `

    expect(offensesFor(source, "herb-counter-comment-out-of-date")).toHaveLength(0)
    expect(offensesFor(source, "herb-counter-comment-unnecessary")).toHaveLength(0)
  })

  test("herb:disable filtering runs before counter, so disabled offenses do not count toward N", () => {
    const source = dedent`
      <%# herb:counter html-tag-name-lowercase 1 %>
      <DIV></DIV> <%# herb:disable html-tag-name-lowercase %>
      <SPAN></SPAN>
    `

    // The DIV is disabled; only the SPAN reaches counter. N=1 == E=1.
    expect(offensesFor(source, target)).toHaveLength(0)
    expect(offensesFor(source, "herb-counter-comment-out-of-date")).toHaveLength(0)
    expect(offensesFor(source, "herb-counter-comment-unnecessary")).toHaveLength(0)
    expect(lintWith(source).counterSuppressed).toBe(1)
  })

  test("--ignore-counter-comments reports every underlying offense and no drift", () => {
    const source = dedent`
      <%# herb:counter html-tag-name-lowercase 5 %>
      <DIV></DIV>
      <SPAN></SPAN>
    `

    const offenses = offensesFor(source, target, { ignoreCounterComments: true })
    expect(offenses).toHaveLength(2)

    // Drift/unnecessary meta-rules are also silenced under --ignore-counter-comments.
    expect(offensesFor(source, "herb-counter-comment-out-of-date", { ignoreCounterComments: true })).toHaveLength(1)
    expect(lintWith(source, { ignoreCounterComments: true }).counterSuppressed).toBe(0)
  })
})
