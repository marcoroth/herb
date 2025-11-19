import dedent from "dedent"

import { describe, it, expect, beforeAll } from "vitest"
import { DiagnosticSeverity, DiagnosticTag } from "vscode-languageserver/node"

import { UnreachableCodeCollector } from "../src/diagnostics"
import { Herb } from "@herb-tools/node-wasm"

describe("Unreachable Code Diagnostics", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  describe("ERB case statements", () => {
    it("detects unreachable code between case and when", () => {
      const content = dedent`
        <% case abc %>
          something here that is not renderable
        <% when String %>
          actual string
        <% end %>
      `

      const parseResult = Herb.parse(content)
      const collector = new UnreachableCodeCollector()
      collector.visit(parseResult.value)

      expect(collector.diagnostics.length).toBeGreaterThan(0)

      const diagnostic = collector.diagnostics[0]
      expect(diagnostic.message).toContain("Unreachable code")
      expect(diagnostic.severity).toBe(DiagnosticSeverity.Hint)
      expect(diagnostic.tags).toContain(DiagnosticTag.Unnecessary)
      expect(diagnostic.source).toBe("Herb Language Server")
    })

    it("detects unreachable code in case/in statements", () => {
      const content = dedent`
        <% case abc %>
        <% in String %>
          actual string
        <% end %>
      `

      const parseResult = Herb.parse(content)
      const collector = new UnreachableCodeCollector()
      collector.visit(parseResult.value)

      expect(collector.diagnostics.length).toBe(0)
    })

    it("detects unreachable HTML content between case and when", () => {
      const content = dedent`
        <% case status %>
          <div>This will never render</div>
          <p>Neither will this</p>
        <% when "active" %>
          <p>Active</p>
        <% when "inactive" %>
          <p>Inactive</p>
        <% end %>
      `

      const parseResult = Herb.parse(content)
      const collector = new UnreachableCodeCollector()
      collector.visit(parseResult.value)

      expect(collector.diagnostics.length).toBeGreaterThan(0)
    })

    it("does not report diagnostics for case without unreachable children", () => {
      const content = dedent`
        <% case status %>
        <% when "active" %>
          <p>Active</p>
        <% when "inactive" %>
          <p>Inactive</p>
        <% else %>
          <p>Unknown</p>
        <% end %>
      `

      const parseResult = Herb.parse(content)
      const collector = new UnreachableCodeCollector()
      collector.visit(parseResult.value)

      expect(collector.diagnostics.length).toBe(0)
    })

    it("detects unreachable code with mixed content", () => {
      const content = dedent`
        <% case type %>
          Some text
          <%= variable %>
          <span>HTML</span>
        <% when :foo %>
          <p>Foo</p>
        <% end %>
      `

      const parseResult = Herb.parse(content)
      const collector = new UnreachableCodeCollector()
      collector.visit(parseResult.value)

      expect(collector.diagnostics.length).toBeGreaterThan(0)
    })
  })

  describe("nested case statements", () => {
    it("detects unreachable code in nested case statements", () => {
      const content = dedent`
        <% case outer %>
          unreachable outer
        <% when "a" %>
          <% case inner %>
            unreachable inner
          <% when "b" %>
            reachable
          <% end %>
        <% end %>
      `

      const parseResult = Herb.parse(content)
      const collector = new UnreachableCodeCollector()
      collector.visit(parseResult.value)

      expect(collector.diagnostics.length).toBeGreaterThanOrEqual(2)
    })
  })
})
