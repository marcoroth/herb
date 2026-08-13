import { describe, test, expect, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { Config } from "@herb-tools/config"

import { Linter } from "../src/linter.js"
import { rules } from "../src/rules.js"

import { ActionViewNoSilentRenderRule } from "../src/rules/actionview-no-silent-render.js"

const SILENT_RENDER = `<% render "shared/error" %>`

function lint(context?: Record<string, any>, config?: Config) {
  const linter = new Linter(Herb, [ActionViewNoSilentRenderRule], config)

  return linter.lint(SILENT_RENDER, context).offenses
}

describe("framework-scoped rules", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  const actionViewRules = rules.filter(ruleClass => ruleClass.ruleName.startsWith("actionview-"))

  test("every actionview rule is scoped to Action View", () => {
    expect(actionViewRules.length).toBeGreaterThan(0)

    for (const ruleClass of actionViewRules) {
      expect(
        new ruleClass().defaultConfig?.frameworks,
        `${ruleClass.ruleName} must declare 'frameworks: ["actionview"]' in its defaultConfig, otherwise it reports on projects that aren't on Action View`
      ).toEqual(["actionview"])
    }
  })

  test("reports when the framework is Action View", () => {
    expect(lint({ framework: "actionview" })).toHaveLength(1)
  })

  test("stays quiet when no framework is configured", () => {
    expect(lint()).toHaveLength(0)
  })

  test("stays quiet on another framework", () => {
    expect(lint({ framework: "hanami" })).toHaveLength(0)
  })

  test("picks up the framework from the config when the context doesn't name one", () => {
    const config = Config.fromObject({ framework: "actionview" })

    expect(lint(undefined, config)).toHaveLength(1)
  })

  test("a rule that leaves frameworks open runs on every framework", () => {
    const linter = new Linter(Herb)

    expect(linter.lint(`<DIV></DIV>`, { framework: "hanami" }).offenses.some(offense => offense.rule === "html-tag-name-lowercase")).toBe(true)
  })

  test("runs anyway when the rule was asked for by name", () => {
    const linter = Linter.from(Herb, undefined, undefined, { only: ["actionview-no-silent-render"] })

    expect(linter.lint(SILENT_RENDER).offenses).toHaveLength(1)
  })

  test("runs anyway under --all-rules", () => {
    const linter = Linter.from(Herb, undefined, undefined, { all: true })

    expect(linter.lint(SILENT_RENDER).offenses.some(offense => offense.rule === "actionview-no-silent-render")).toBe(true)
  })

  test("frameworks can be widened from the config", () => {
    const config = Config.fromObject({
      linter: {
        rules: {
          "actionview-no-silent-render": {
            frameworks: ["ruby", "actionview"]
          }
        }
      }
    })

    expect(lint({ framework: "ruby" }, config)).toHaveLength(1)
  })
})
