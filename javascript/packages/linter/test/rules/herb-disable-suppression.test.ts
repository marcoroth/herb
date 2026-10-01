import dedent from "dedent"

import { beforeAll, describe, test, expect } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { Config } from "@herb-tools/config"

import { Linter } from "../../src/linter.js"

import { HTMLTagNameLowercaseRule } from "../../src/rules/html-tag-name-lowercase.js"
import { HTMLAttributeDoubleQuotesRule } from "../../src/rules/html-attribute-double-quotes.js"
import { HerbDisableCommentOutOfDateRule } from "../../src/rules/herb-disable-comment-out-of-date.js"

const target = "html-tag-name-lowercase"

const lintWith = (source: string, options: { ignoreCounterComments?: boolean, ignoreDisableComments?: boolean } = {}) => {
  const config = Config.fromObject({
    linter: {
      rules: {
        [target]: { enabled: true, severity: "error" },
        "herb-disable-comment-out-of-date": { enabled: true, severity: "warning" },
      },
    },
  })

  const linter = new Linter(
    Herb,
    [HTMLTagNameLowercaseRule, HerbDisableCommentOutOfDateRule],
    config,
  )

  return linter.lint(source, options)
}

const offensesFor = (source: string, rule: string, options?: { ignoreCounterComments?: boolean, ignoreDisableComments?: boolean }) =>
  lintWith(source, options).offenses.filter(offense => offense.rule === rule)

describe("file-scoped herb:disable suppression semantics", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("N == E suppresses every offense and reports no drift", () => {
    const source = dedent`
      <%# herb:disable html-tag-name-lowercase 4 %>
      <DIV></DIV>
      <SPAN></SPAN>
    `

    expect(offensesFor(source, target)).toHaveLength(0)
    expect(offensesFor(source, "herb-disable-comment-out-of-date")).toHaveLength(0)
    expect(lintWith(source).counterSuppressed).toBe(4)
  })

  test("N > E reports every offense AND emits herb-disable-comment-out-of-date", () => {
    const source = dedent`
      <%# herb:disable html-tag-name-lowercase 8 %>
      <DIV></DIV>
      <SPAN></SPAN>
      <SECTION></SECTION>
    `

    expect(offensesFor(source, target)).toHaveLength(6)

    const drift = offensesFor(source, "herb-disable-comment-out-of-date")
    expect(drift).toHaveLength(1)
    expect(drift[0].message).toContain("8")
    expect(drift[0].message).toContain("6")
    expect(lintWith(source).counterSuppressed ?? 0).toBe(0)
  })

  test("0 < N < E suppresses the first N offenses and emits herb-disable-comment-out-of-date", () => {
    const source = dedent`
      <%# herb:disable html-tag-name-lowercase 1 %>
      <DIV></DIV>
    `

    expect(offensesFor(source, target)).toHaveLength(1)

    const drift = offensesFor(source, "herb-disable-comment-out-of-date")
    expect(drift).toHaveLength(1)
    expect(drift[0].message).toContain("1")
    expect(drift[0].message).toContain("2")
    expect(lintWith(source).counterSuppressed).toBe(1)
  })

  test("N > 0, E == 0 emits herb-disable-comment-out-of-date", () => {
    const source = dedent`
      <%# herb:disable html-tag-name-lowercase 3 %>
      <div></div>
    `

    const drift = offensesFor(source, "herb-disable-comment-out-of-date")
    expect(drift).toHaveLength(1)
  })

  test("N == 0 and E == 0 emits no drift", () => {
    const source = dedent`
      <%# herb:disable html-tag-name-lowercase 0 %>
      <div></div>
    `

    expect(offensesFor(source, "herb-disable-comment-out-of-date")).toHaveLength(0)
  })

  test("`all` suppresses every offense and never reports drift", () => {
    const source = dedent`
      <%# herb:disable html-tag-name-lowercase all %>
      <DIV></DIV>
      <SPAN></SPAN>
      <SECTION></SECTION>
    `

    expect(offensesFor(source, target)).toHaveLength(0)
    expect(offensesFor(source, "herb-disable-comment-out-of-date")).toHaveLength(0)
    expect(lintWith(source).counterSuppressed).toBe(6)
  })

  test("line-scoped herb:disable filtering runs before file-scoped counting", () => {
    const source = dedent`
      <%# herb:disable html-tag-name-lowercase 2 %>
      <DIV></DIV> <%# herb:disable html-tag-name-lowercase %>
      <SPAN></SPAN>
    `

    expect(offensesFor(source, target)).toHaveLength(0)
    expect(offensesFor(source, "herb-disable-comment-out-of-date")).toHaveLength(0)
    expect(lintWith(source).counterSuppressed).toBe(2)
  })

  test("--ignore-disable-comments reports every underlying offense and no drift", () => {
    const source = dedent`
      <%# herb:disable html-tag-name-lowercase 5 %>
      <DIV></DIV>
      <SPAN></SPAN>
    `

    const offenses = offensesFor(source, target, { ignoreDisableComments: true })
    expect(offenses).toHaveLength(4)

    expect(lintWith(source, { ignoreDisableComments: true }).counterSuppressed ?? 0).toBe(0)
  })
})

describe("file-scoped herb:disable autofix", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  const buildLinter = () => {
    const config = Config.fromObject({
      linter: {
        rules: {
          "html-tag-name-lowercase": { enabled: true, severity: "error" },
          "html-attribute-double-quotes": { enabled: true, severity: "error" },
          "herb-disable-comment-out-of-date": { enabled: true, severity: "warning" },
        },
      },
    })

    return new Linter(
      Herb,
      [HTMLTagNameLowercaseRule, HTMLAttributeDoubleQuotesRule, HerbDisableCommentOutOfDateRule],
      config,
    )
  }

  test("rewrites the count of the entry that drifted, not a matching token from another entry", () => {
    const source = dedent`
      <%# herb:disable html-tag-name-lowercase 1, html-attribute-double-quotes 1 %>
      <DIV class='one'></DIV>
    `

    const drift = buildLinter().lint(source).offenses.filter(offense => offense.rule === "herb-disable-comment-out-of-date")

    expect(drift).toHaveLength(1)

    const result = buildLinter().autofix(source, {}, drift)

    expect(result.source.split("\n")[0]).toBe("<%# herb:disable html-tag-name-lowercase 2, html-attribute-double-quotes 1 %>")
  })
})

describe("file-scoped herb:disable entries for rules that are not enabled", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  const buildLinter = () => {
    const config = Config.fromObject({
      linter: {
        rules: {
          "html-tag-name-lowercase": { enabled: false },
          "herb-disable-comment-out-of-date": { enabled: true, severity: "warning" },
        },
      },
    })

    return new Linter(
      Herb,
      [HerbDisableCommentOutOfDateRule],
      config,
      [HTMLTagNameLowercaseRule, HerbDisableCommentOutOfDateRule],
    )
  }

  const source = dedent`
    <%# herb:disable html-tag-name-lowercase 2 %>
    <DIV></DIV>
  `

  test("reports the entry as unverifiable", () => {
    const offenses = buildLinter().lint(source).offenses.filter(offense => offense.rule === "herb-disable-comment-out-of-date")

    expect(offenses).toHaveLength(1)
    expect(offenses[0].message).toContain("is not enabled")
  })

  test("leaves the count alone instead of rewriting it to zero", () => {
    const linter = buildLinter()
    const offenses = linter.lint(source).offenses.filter(offense => offense.rule === "herb-disable-comment-out-of-date")
    const result = linter.autofix(source, {}, offenses)

    expect(result.source).toBe(source)
    expect(result.fixed).toHaveLength(0)
    expect(result.unfixed).toHaveLength(1)
  })
})

