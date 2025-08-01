import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Linter } from "../src/linter.js"
import { HTMLTagNameLowercaseRule } from "../src/rules/html-tag-name-lowercase.js"

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
})
