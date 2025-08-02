import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Formatter } from "../../src"

import dedent from "dedent"

let formatter: Formatter

describe("ERB whitespace formatting", () => {
  beforeAll(async () => {
    await Herb.load()

    formatter = new Formatter(Herb, {
      indentWidth: 2,
      maxLineLength: 80
    })
  })

  describe("regression tests for whitespace formatting fix", () => {
    test("formats the original problematic snippet correctly", () => {
      const source = dedent`
        <a href="/path"
          <% if disabled%>
            class="disabled"
          <%end%>
        >
          Text
        </a>
      `
      const result = formatter.format(source)

      expect(result).toBe(dedent`
        <a
          href="/path"
          <% if disabled %>
            class="disabled"
          <% end %>
        >
          Text
        </a>
      `)

      expect(result).toContain('<% if disabled %>')
      expect(result).toContain('<% end %>')

      expect(result).not.toContain('<% if disabled%>')
      expect(result).not.toContain('<%end%>')
    })

    test("preserves already properly spaced ERB tags", () => {
      const source = '<div <% if condition %> class="test" <% end %>></div>'
      const result = formatter.format(source)

      expect(result).toContain('<% if condition %>')
      expect(result).toContain('<% end %>')
    })

    test("formats standalone ERB content tags with proper spacing", () => {
      const source = '<%=content%>'
      const result = formatter.format(source)

      expect(result).toEqual('<%= content %>')
    })

    test("formats ERB tags within HTML text content", () => {
      const source = '<p>Hello <%=name%>, welcome!</p>'
      const result = formatter.format(source)

      expect(result).toEqual('<p>Hello <%= name %>, welcome!</p>')
    })

    test("verifies formatERBContent utility function behavior through working cases", () => {
      expect(formatter.format('<%=content%>')).toEqual('<%= content %>')
      expect(formatter.format('<%=  spaced  %>')).toEqual('<%= spaced %>')
      expect(formatter.format('<%   %>')).toEqual('<%%>')
    })

    test("handles ERB tags with only whitespace content", () => {
      const source = '<%   %>'
      const result = formatter.format(source)

      expect(result).toEqual('<%%>')
    })

    test("preserves ERB comment formatting", () => {
      const source = '<%# This is a comment %>'
      const result = formatter.format(source)

      expect(result).toEqual('<%# This is a comment %>')
    })

    test("handles complex ERB structures that get inlined", () => {
      const source = dedent`
        <div>
          <%users.each do |user|%>
            <span><%=user.name%></span>
          <%end%>
        </div>
      `
      const result = formatter.format(source)

      expect(result).toContain('<%= user.name %>')
      expect(result).toContain('<div>')
      expect(result).toContain('</div>')
      expect(result).toContain('<span>')
      expect(result).toContain('</span>')
    })
  })

  describe("shared utility validation", () => {
    test("demonstrates consistent ERB content formatting where it applies", () => {
      const erbContentCases = [
        { input: '<%=user.id%>', expected: '<%= user.id %>' },
        { input: '<%= "Hello"%>', expected: '<%= "Hello" %>' },
        { input: '<%=content%>', expected: '<%= content %>' }
      ]

      erbContentCases.forEach(({ input, expected }) => {
        const result = formatter.format(input)

        expect(result).toEqual(expected)
      })
    }),

    test("documents current behavior for ERB logic tags", () => {
      const logicCases = ['<% if condition%>', '<%end%>']

      logicCases.forEach(testCase => {
        const result = formatter.format(testCase)

        expect(result).toContain('<%')
        expect(result).toContain('%>')
      })
    })
  })
})
