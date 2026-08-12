import { describe, test, expect, beforeAll } from "vitest"
import { Herb, inspectPrismNode } from "../src/index.ts"

describe("parseRuby", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("parseRuby() parses a simple expression", () => {
    const source = "1 + 2"
    const result = Herb.parseRuby(source)
    expect(inspectPrismNode(result.value, source)).toMatchSnapshot()
  })

  test("parseRuby() parses a class definition", () => {
    const source = "class Foo; end"
    const result = Herb.parseRuby(source)
    expect(inspectPrismNode(result.value, source)).toMatchSnapshot()
  })

  test("parseRuby() parses a method definition", () => {
    const source = 'def greet(name)\n  "Hello, #{name}!"\nend'
    const result = Herb.parseRuby(source)
    expect(inspectPrismNode(result.value, source)).toMatchSnapshot()
  })

  test("parseRuby() parses raw Ruby, not ERB", () => {
    const source = "x = 1 + 2"
    const result = Herb.parseRuby(source)
    expect(inspectPrismNode(result.value, source)).toMatchSnapshot()
  })
})
