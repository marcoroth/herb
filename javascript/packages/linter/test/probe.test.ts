import { describe, test, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Config } from "@herb-tools/config"
import { Linter } from "../src/linter.js"

const GRAPHQL_TEMPLATE = `<%graphql query Products($first: Int!) { products(first: $first) { id } } %>`

describe("probe", () => {
  beforeAll(async () => { await Herb.load() })

  test("probe", () => {
    const config = Config.fromObject({ parser: { erb_openers: ["graphql"] } })
    const linter = Linter.from(Herb, config)
    const result = linter.lint(GRAPHQL_TEMPLATE)
    for (const offense of result.offenses) {
      console.log(offense.rule, "|", offense.message)
    }
    const parsed = Herb.parse(GRAPHQL_TEMPLATE, { ...config.parserOptions, track_whitespace: true })
    console.log("direct errors:", parsed.errors.length, "parsed flag:", (parsed.value.children[0] as any)?.parsed)
  })
})
