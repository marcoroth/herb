import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Config } from "@herb-tools/config"

import { Formatter } from "../src"

const GRAPHQL_TEMPLATE = `<div>\n<%graphql query Products($first: Int!) { products(first: $first) { id } } %>\n<p><%= product.title %></p>\n</div>`

describe("erb_openers", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("declines to format a template using an opener it does not know", () => {
    const formatter = new Formatter(Herb)
    const result = formatter.formatWithResult(GRAPHQL_TEMPLATE)

    expect(result.skipped).toBe("parse-errors")
    expect(result.errorCount).toBeGreaterThan(0)
    expect(result.output).toBe(GRAPHQL_TEMPLATE)
  })

  test("formats a template whose opener it was given", () => {
    const formatter = new Formatter(Herb, {}, { erb_openers: ["graphql"] })
    const result = formatter.formatWithResult(GRAPHQL_TEMPLATE)

    expect(result.skipped).toBeNull()
    expect(result.errorCount).toBe(0)
    expect(result.output).toContain("<%graphql")
  })

  test("takes the openers from a config", () => {
    const config = Config.fromObject({ parser: { erb_openers: ["graphql"] } })
    const formatter = Formatter.from(Herb, config)

    expect(formatter.formatWithResult(GRAPHQL_TEMPLATE).skipped).toBeNull()
  })

  test("declines again when the config names no openers", () => {
    const config = Config.fromObject({})
    const formatter = Formatter.from(Herb, config)

    expect(formatter.formatWithResult(GRAPHQL_TEMPLATE).skipped).toBe("parse-errors")
  })

  test("keeps a configured tag and its query in the output", () => {
    const formatter = new Formatter(Herb, {}, { erb_openers: ["graphql"] })
    const output = formatter.format(GRAPHQL_TEMPLATE)

    expect(output).toContain("<%graphql")
    expect(output).toContain("products(first: $first)")
  })
})
