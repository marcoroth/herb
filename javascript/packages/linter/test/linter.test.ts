import { describe, test, expect, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../src/linter.js"

import { HTMLTagNameLowercaseRule } from "../src/rules/html-tag-name-lowercase.js"
import { ParserRule, SourceRule } from "../src/types.js"

import type { LintOffense, LintContext } from "../src/types.js"
import type { ParseResult } from "@herb-tools/core"

describe("@herb-tools/linter", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  describe("Linter", () => {
    test("is defined", () => {
      expect(Linter).toBeDefined()
    })

    test("can be instantiated", () => {
      const linter = new Linter(Herb)
      expect(linter).toBeInstanceOf(Linter)
    })

    test("can be instantiated with custom rules", () => {
      const linter = new Linter(Herb, [HTMLTagNameLowercaseRule])
      expect(linter).toBeInstanceOf(Linter)
    })
  })

  describe("Linter functionality", () => {
    test("can lint a document with default rules", () => {
      const html = '<div><span>Hello</span></div>'
      const linter = new Linter(Herb)
      const lintResult = linter.lint(html)

      expect(lintResult).toHaveProperty('offenses')
      expect(lintResult).toHaveProperty('errors')
      expect(lintResult).toHaveProperty('warnings')
      expect(Array.isArray(lintResult.offenses)).toBe(true)
    })

    test("returns correct error and warning counts", () => {
      const html = '<DIV><SPAN>Hello</SPAN></DIV>\n'
      const linter = new Linter(Herb)
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(4)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(4)

      const allErrors = lintResult.offenses.every(offense => offense.severity === "error")
      expect(allErrors).toBe(true)
    })

    test("can run with no rules", () => {
      const html = '<DIV><SPAN>Hello</SPAN></DIV>'
      const linter = new Linter(Herb, [])
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(0)
      expect(lintResult.warnings).toBe(0)
      expect(lintResult.offenses).toHaveLength(0)
    })

    test("processes complex ERB templates", () => {
      const html = `
        <div class="<%= classes %>">
          <% items.each do |item| %>
            <span><%= item.name %></span>
          <% end %>
        </div>
      ` + '\n'

      const linter = new Linter(Herb)
      const lintResult = linter.lint(html)

      expect(lintResult.errors).toBe(0)
    })
  })

  describe("Rule enablement", () => {
    class EnabledParserRule extends ParserRule {
      name = "enabled-parser-rule"

      check(_result: ParseResult): LintOffense[] {
        return [{
          message: "Test offense",
          location: { start: { line: 1, column: 1 }, end: { line: 1, column: 1 } },
          severity: "error",
          rule: this.name,
          code: this.name,
          source: "linter"
        }]
      }
    }

    class DisabledParserRule extends ParserRule {
      name = "disabled-parser-rule"

      isEnabled(): boolean {
        return false
      }

      check(_result: ParseResult): LintOffense[] {
        return [{
          message: "This should never appear",
          location: { start: { line: 1, column: 1 }, end: { line: 1, column: 1 } },
          severity: "error",
          rule: this.name,
          code: this.name,
          source: "linter"
        }]
      }
    }

    class FileBasedRule extends SourceRule {
      name = "file-based-rule"

      isEnabled(_source: string, context?: Partial<LintContext>): boolean {
        return context?.fileName?.endsWith('.erb') || false
      }

      check(_source: string): LintOffense[] {
        return [{
          message: "ERB file detected",
          location: { start: { line: 1, column: 1 }, end: { line: 1, column: 1 } },
          severity: "info",
          rule: this.name,
          code: this.name,
          source: "linter"
        }]
      }
    }

    class ContentBasedRule extends ParserRule {
      name = "content-based-rule"

      isEnabled(result: ParseResult): boolean {
        return JSON.stringify(result.value).includes('"value":"div"')
      }

      check(_result: ParseResult): LintOffense[] {
        return [{
          message: "Div found",
          location: { start: { line: 1, column: 1 }, end: { line: 1, column: 1 } },
          severity: "info",
          rule: this.name,
          code: this.name,
          source: "linter"
        }]
      }
    }

    test("runs enabled rules", () => {
      const html = '<div>test</div>'
      const linter = new Linter(Herb, [EnabledParserRule])
      const lintResult = linter.lint(html)

      expect(lintResult.offenses).toHaveLength(1)
      expect(lintResult.offenses[0].rule).toBe("enabled-parser-rule")
    })

    test("skips disabled rules", () => {
      const html = '<div>test</div>'
      const linter = new Linter(Herb, [DisabledParserRule])
      const lintResult = linter.lint(html)

      expect(lintResult.offenses).toHaveLength(0)
    })

    test("file-based enablement works", () => {
      const html = '<div>test</div>'
      const linter = new Linter(Herb, [FileBasedRule])

      const result1 = linter.lint(html, { fileName: 'test.html' })
      expect(result1.offenses).toHaveLength(0)

      const result2 = linter.lint(html, { fileName: 'test.erb' })
      expect(result2.offenses).toHaveLength(1)
      expect(result2.offenses[0].rule).toBe("file-based-rule")
    })

    test("content-based enablement works", () => {
      const linter = new Linter(Herb, [ContentBasedRule])

      const result1 = linter.lint('<span>test</span>')
      expect(result1.offenses).toHaveLength(0)

      const result2 = linter.lint('<div>test</div>')
      expect(result2.offenses).toHaveLength(1)
      expect(result2.offenses[0].rule).toBe("content-based-rule")
    })
  })
})
