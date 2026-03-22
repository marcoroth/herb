import { describe, it, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { TurboLinter, defaultRules } from "../src/index.js"

describe("TurboLinter basic test", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  it("should create linter instance", () => {
    const linter = new TurboLinter(Herb, defaultRules)
    expect(linter).toBeDefined()
    expect(linter.getRuleCount()).toBeGreaterThan(0)
  })

  it("should lint turbo templates", () => {
    const linter = new TurboLinter(Herb, defaultRules)

    const source = `
      <div id="cart-counter" data-turbo-permanent>
        1 item
      </div>
    `

    const result = linter.lint(source)
    expect(result).toBeDefined()
    expect(result.offenses).toBeDefined()
    expect(result.offenses).toHaveLength(0)
  })

  it("should detect turbo-permanent issues", () => {
    const linter = new TurboLinter(Herb, defaultRules)

    const source = `
      <div id="cart-counter" data-turbo-permanent="false">
        1 item
      </div>
    `

    const result = linter.lint(source)
    expect(result).toBeDefined()
    expect(result.offenses).toBeDefined()
    expect(result.offenses).toHaveLength(1)
    expect(result.offenses[0].rule).toBe("html-turbo-permanent")
  })
})
