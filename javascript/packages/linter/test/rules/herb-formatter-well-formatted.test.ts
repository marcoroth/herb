import dedent from "dedent"

import { describe, test, beforeAll, expect } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../../src/linter.js"
import { Config } from "@herb-tools/config"

import { HerbFormatterWellFormattedRule } from "../../src/rules/herb-formatter-well-formatted.js"

function createTestConfig() {
  return Config.fromObject({
    formatter: {
      enabled: true
    },
    linter: {
      rules: {
        "herb-formatter-well-formatted": { enabled: true }
      }
    }
  })
}

function lintSource(source: string, context?: { fileName?: string }) {
  const config = createTestConfig()
  const linter = new Linter(Herb, [HerbFormatterWellFormattedRule], config)
  const result = linter.lint(source, context)
  return result.offenses.filter(o => o.rule === "herb-formatter-well-formatted")
}

describe("HerbFormatterWellFormattedRule", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  describe("well-formatted source", () => {
    test("should not report errors for already formatted HTML", () => {
      const html = dedent`
        <div>
          <p>Hello</p>
        </div>
      `

      const offenses = lintSource(html)
      expect(offenses).toHaveLength(0)
    })

    test("should not report errors for simple one-line HTML", () => {
      const html = `<p>Hello</p>`

      const offenses = lintSource(html)
      expect(offenses).toHaveLength(0)
    })

    test("should not report errors for empty source", () => {
      const html = ``

      const offenses = lintSource(html)
      expect(offenses).toHaveLength(0)
    })

    test("should not report errors for formatted ERB", () => {
      const html = `<div><%= @title %></div>`

      const offenses = lintSource(html)
      expect(offenses).toHaveLength(0)
    })
  })

  describe("unformatted source", () => {
    test("should report warning for incorrect indentation", () => {
      const html = dedent`
        <div>
        <p>Hello</p>
        </div>
      ` + '\n'

      const offenses = lintSource(html)
      expect(offenses.length).toBeGreaterThan(0)
      expect(offenses[0].severity).toBe("warning")
      expect(offenses[0].message).toContain("indentation")
    })

    test("should report warning for formatting differences", () => {
      const html = `<div>   </div>\n`

      const offenses = lintSource(html)
      expect(offenses.length).toBeGreaterThan(0)
      expect(offenses[0].severity).toBe("warning")
    })
  })

  describe("disabled by default", () => {
    test("rule should be disabled by default", () => {
      const rule = new HerbFormatterWellFormattedRule()

      expect(rule.defaultConfig.enabled).toBe(false)
    })

    test("rule severity should be warning by default", () => {
      const rule = new HerbFormatterWellFormattedRule()

      expect(rule.defaultConfig.severity).toBe("warning")
    })
  })

  describe("formatter config checks", () => {
    test("rule should not run if formatter is not enabled in config", () => {
      const configWithoutFormatter = Config.fromObject({
        formatter: {
          enabled: false
        },
        linter: {
          rules: {
            "herb-formatter-well-formatted": { enabled: true }
          }
        }
      })

      const linter = new Linter(Herb, [HerbFormatterWellFormattedRule], configWithoutFormatter)
      const unformatted = dedent`
        <div>
        <p>Hello</p>
        </div>
      ` + '\n'

      const result = linter.lint(unformatted)
      const offenses = result.offenses.filter(o => o.rule === "herb-formatter-well-formatted")

      expect(offenses).toHaveLength(0)
    })

    test("rule should run if formatter is enabled in config", () => {
      const unformatted = dedent`
        <div>
        <p>Hello</p>
        </div>
      ` + '\n'

      const offenses = lintSource(unformatted)
      expect(offenses.length).toBeGreaterThan(0)
    })
  })

  describe("parse error handling", () => {
    test("should gracefully skip source with parse errors", () => {
      const html = `<div><p>Unclosed`

      const offenses = lintSource(html)
      expect(offenses).toHaveLength(0)
    })
  })
})
