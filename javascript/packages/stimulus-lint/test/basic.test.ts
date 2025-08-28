import { describe, it, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { StimulusLinter, defaultRules } from "../src/index.js"

describe("StimulusLinter basic test", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  it("should create linter instance", () => {
    const linter = new StimulusLinter(Herb, defaultRules)
    expect(linter).toBeDefined()
    expect(linter.getRuleCount()).toBeGreaterThan(0)
  })

  it("should lint without project", () => {
    const linter = new StimulusLinter(Herb, defaultRules)

    const source = `
      <div data-controller="hello">
        <button data-controller="dropdown">Click me</button>
      </div>
    `

    const result = linter.lint(source)
    expect(result).toBeDefined()
    expect(result.offenses).toBeDefined()
    expect(result.offenses).toHaveLength(0)
  })
})
