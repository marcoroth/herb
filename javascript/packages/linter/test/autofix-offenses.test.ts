import dedent from "dedent"

import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"

import { Linter } from "../src/linter.js"

import type { AutofixResult, LintContext } from "../src/types.js"

describe("Linter#autofix with explicit offenses", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  const context: Partial<LintContext> = { fileName: "app/views/posts/index.html.erb" }

  function ruleNames(offenses: AutofixResult["fixed"]): string[] {
    return offenses.map(offense => offense.rule).sort()
  }

  function bothWays(source: string, options?: { includeUnsafe?: boolean }): [AutofixResult, AutofixResult] {
    const linter = new Linter(Herb)
    const lintResult = linter.lint(source, context)

    expect(lintResult.offenses.length).toBeGreaterThan(0)

    const reused = linter.autofix(source, context, lintResult.offenses, options)
    const relinted = linter.autofix(source, context, undefined, options)

    return [reused, relinted]
  }

  function expectSameResult(source: string, options?: { includeUnsafe?: boolean }) {
    const [reused, relinted] = bothWays(source, options)

    expect(reused.source).toBe(relinted.source)
    expect(ruleNames(reused.fixed)).toEqual(ruleNames(relinted.fixed))
    expect(ruleNames(reused.unfixed)).toEqual(ruleNames(relinted.unfixed))

    return reused
  }

  test("fixes the same offenses as autofix that lints internally", () => {
    const source = dedent`
      <DIV CLASS='card'>
        <span>Hello</span>
      </DIV>
    `

    const result = expectSameResult(source)

    expect(result.fixed.length).toBeGreaterThan(0)
    expect(result.source).not.toBe(source)
  })

  test("fixes the same offenses across parser and source rules", () => {
    const source = "<div class='card'>  \n  <img src='a.png'>\n</div>"

    const result = expectSameResult(source)

    expect(result.fixed.length).toBeGreaterThan(0)
  })

  test("fixes the same offenses with unsafe fixes included", () => {
    const source = dedent`
      <DIV CLASS='card'>
        <%= "Hello" %>
      </DIV>
    `

    expectSameResult(source, { includeUnsafe: true })
  })

  test("leaves the same offenses unfixed", () => {
    const source = dedent`
      <div>
        <img src="a.png">
      </div>
    `

    const linter = new Linter(Herb)
    const lintResult = linter.lint(source, context)

    const reused = linter.autofix(source, context, lintResult.offenses)
    const relinted = linter.autofix(source, context, undefined)

    expect(ruleNames(reused.unfixed)).toEqual(ruleNames(relinted.unfixed))
    expect(reused.unfixed.length).toBeGreaterThan(0)
  })
})
