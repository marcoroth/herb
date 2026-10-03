import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Config } from "@herb-tools/config"

import { Linter } from "../src/linter.js"

const GRAPHQL_TEMPLATE = `<%graphql query Products($first: Int!) { products(first: $first) { id } } %>`

function rulesReportedFor(linter: Linter, source: string): string[] {
  return linter.lint(source).offenses.map(offense => offense.rule)
}

describe("erb_openers", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("reads a template using an unknown opener as Ruby", () => {
    const linter = Linter.from(Herb, Config.fromObject({}))

    expect(rulesReportedFor(linter, GRAPHQL_TEMPLATE)).toContain("parser-no-errors")
  })

  test("takes the openers a config names", () => {
    const config = Config.fromObject({ parser: { erb_openers: ["graphql"] } })
    const linter = Linter.from(Herb, config)

    expect(rulesReportedFor(linter, GRAPHQL_TEMPLATE)).not.toContain("parser-no-errors")
  })

  test("leaves a configured tag alone when autofixing", () => {
    const config = Config.fromObject({ parser: { erb_openers: ["graphql"] } })
    const linter = Linter.from(Herb, config)

    expect(linter.autofix(GRAPHQL_TEMPLATE).source).toContain("<%graphql")
  })

  test("gives the autofix pass a backend, so commented tag prefixes still resolve", () => {
    const linter = new Linter(Herb)
    const result = linter.autofix(`<%#=  link_to "path", path %>`)

    expect(result.source).toBe(`<%#= link_to "path", path %>`)
  })
})
