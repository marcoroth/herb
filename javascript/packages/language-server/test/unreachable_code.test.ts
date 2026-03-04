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

  describe("empty ERB control flow blocks", () => {
    describe("if statements", () => {
      it("detects empty if block", () => {
        const content = dedent`
          <% if condition %>
          <% end %>
        `

        const parseResult = Herb.parse(content)
        const collector = new UnreachableCodeCollector()
        collector.visit(parseResult.value)

        expect(collector.diagnostics.length).toBe(1)
        expect(collector.diagnostics[0].message).toContain("Empty if block")
        expect(collector.diagnostics[0].severity).toBe(DiagnosticSeverity.Hint)
        expect(collector.diagnostics[0].tags).toContain(DiagnosticTag.Unnecessary)
      })

      it("detects if block with only whitespace", () => {
        const content = dedent`
          <% if condition %>


          <% end %>
        `

        const parseResult = Herb.parse(content)
        const collector = new UnreachableCodeCollector()
        collector.visit(parseResult.value)

        expect(collector.diagnostics.length).toBe(1)
        expect(collector.diagnostics[0].message).toContain("Empty if block")
      })

      it("does not flag if block with content", () => {
        const content = dedent`
          <% if condition %>
            <p>Content</p>
          <% end %>
        `

        const parseResult = Herb.parse(content)
        const collector = new UnreachableCodeCollector()
        collector.visit(parseResult.value)

        expect(collector.diagnostics.length).toBe(0)
      })

      it("flags empty if block even when else has content", () => {
        const content = dedent`
          <% if true %>

          <% else %>
            a
          <% end %>
        `

        const parseResult = Herb.parse(content)
        const collector = new UnreachableCodeCollector()
        collector.visit(parseResult.value)

        expect(collector.diagnostics.length).toBe(1)
        expect(collector.diagnostics[0].message).toContain("Empty if block")

        const diagnostic = collector.diagnostics[0]
        const ifNode = parseResult.value.children[0] as any
        expect(diagnostic.range.end.line).toBeLessThan(ifNode.location.end.line - 1)
      })

      it("flags empty if block when elsif has content", () => {
        const content = dedent`
          <% if condition1 %>
          <% elsif condition2 %>
            <p>Content in elsif</p>
          <% end %>
        `

        const parseResult = Herb.parse(content)
        const collector = new UnreachableCodeCollector()
        collector.visit(parseResult.value)

        expect(collector.diagnostics.length).toBe(1)
        expect(collector.diagnostics[0].message).toContain("Empty if block")
      })

      it("detects completely empty if/elsif/else chain", () => {
        const content = dedent`
          <% if condition1 %>
          <% elsif condition2 %>
          <% else %>
          <% end %>
        `

        const parseResult = Herb.parse(content)
        const collector = new UnreachableCodeCollector()
        collector.visit(parseResult.value)

        expect(collector.diagnostics.length).toBe(1)
        expect(collector.diagnostics[0].message).toContain("Empty if block")

        const ifNode = parseResult.value.children[0] as any
        expect(collector.diagnostics[0].range.end.line).toBe(ifNode.location.end.line - 1)
      })

      it("flags only empty elsif when if and else have content", () => {
        const content = dedent`
          <% if condition1 %>
            a
          <% elsif condition2 %>
          <% else %>
            b
          <% end %>
        `

        const parseResult = Herb.parse(content)
        const collector = new UnreachableCodeCollector()
        collector.visit(parseResult.value)

        expect(collector.diagnostics.length).toBe(1)
        expect(collector.diagnostics[0].message).toContain("Empty elsif block")
      })

      it("flags multiple empty blocks in if/elsif/else chain", () => {
        const content = dedent`
          <% if condition1 %>
          <% elsif condition2 %>
            a
          <% else %>
          <% end %>
        `

        const parseResult = Herb.parse(content)
        const collector = new UnreachableCodeCollector()
        collector.visit(parseResult.value)

        expect(collector.diagnostics.length).toBe(2)
        expect(collector.diagnostics[0].message).toContain("Empty if block")
        expect(collector.diagnostics[1].message).toContain("Empty else block")
      })
    })

    describe("else statements", () => {
      it("detects completely empty if/else block", () => {
        const content = dedent`
          <% if true %>

          <% else %>

          <% end %>
        `

        const parseResult = Herb.parse(content)
        const collector = new UnreachableCodeCollector()
        collector.visit(parseResult.value)

        expect(collector.diagnostics.length).toBe(1)
        expect(collector.diagnostics[0].message).toContain("Empty if block")

        const ifNode = parseResult.value.children[0] as any
        expect(collector.diagnostics[0].range.end.line).toBe(ifNode.location.end.line - 1)
      })

      it("does not flag else when if has content", () => {
        const content = dedent`
          <% if condition %>
            <p>Content</p>
          <% else %>
          <% end %>
        `

        const parseResult = Herb.parse(content)
        const collector = new UnreachableCodeCollector()
        collector.visit(parseResult.value)

        expect(collector.diagnostics.length).toBe(1)
        expect(collector.diagnostics[0].message).toContain("Empty else block")
      })

      it("flags empty else when if has content", () => {
        const content = dedent`
          <% if true %>
            a
          <% else %>

          <% end %>
        `

        const parseResult = Herb.parse(content)
        const collector = new UnreachableCodeCollector()
        collector.visit(parseResult.value)

        expect(collector.diagnostics.length).toBe(1)
        expect(collector.diagnostics[0].message).toContain("Empty else block")

        const diagnostic = collector.diagnostics[0]
        const ifNode = parseResult.value.children[0] as any
        expect(diagnostic.range.end.line).toBe(ifNode.location.end.line - 1)
      })
    })

    describe("unless statements", () => {
      it("detects empty unless block", () => {
        const content = dedent`
          <% unless condition %>
          <% end %>
        `

        const parseResult = Herb.parse(content)
        const collector = new UnreachableCodeCollector()
        collector.visit(parseResult.value)

        expect(collector.diagnostics.length).toBe(1)
        expect(collector.diagnostics[0].message).toContain("Empty unless block")
      })

      it("does not flag unless block with content", () => {
        const content = dedent`
          <% unless condition %>
            <p>Content</p>
          <% end %>
        `

        const parseResult = Herb.parse(content)
        const collector = new UnreachableCodeCollector()
        collector.visit(parseResult.value)

        expect(collector.diagnostics.length).toBe(0)
      })

      it("flags empty unless block even when else has content", () => {
        const content = dedent`
          <% unless condition %>
          <% else %>
            <p>Content in else</p>
          <% end %>
        `

        const parseResult = Herb.parse(content)
        const collector = new UnreachableCodeCollector()
        collector.visit(parseResult.value)

        expect(collector.diagnostics.length).toBe(1)
        expect(collector.diagnostics[0].message).toContain("Empty unless block")
      })

      it("detects completely empty unless/else block", () => {
        const content = dedent`
          <% unless condition %>
          <% else %>
          <% end %>
        `

        const parseResult = Herb.parse(content)
        const collector = new UnreachableCodeCollector()
        collector.visit(parseResult.value)

        expect(collector.diagnostics.length).toBe(1)
        expect(collector.diagnostics[0].message).toContain("Empty unless block")

        const unlessNode = parseResult.value.children[0] as any
        expect(collector.diagnostics[0].range.end.line).toBe(unlessNode.location.end.line - 1)
      })

      it("flags empty else when unless has content", () => {
        const content = dedent`
          <% unless true %>
            a
          <% else %>

          <% end %>
        `

        const parseResult = Herb.parse(content)
        const collector = new UnreachableCodeCollector()
        collector.visit(parseResult.value)

        expect(collector.diagnostics.length).toBe(1)
        expect(collector.diagnostics[0].message).toContain("Empty else block")
      })
    })

    describe("for loops", () => {
      it("detects empty for loop", () => {
        const content = dedent`
          <% for item in items %>
          <% end %>
        `

        const parseResult = Herb.parse(content)
        const collector = new UnreachableCodeCollector()
        collector.visit(parseResult.value)

        expect(collector.diagnostics.length).toBe(1)
        expect(collector.diagnostics[0].message).toContain("Empty for block")
      })

      it("does not flag for loop with content", () => {
        const content = dedent`
          <% for item in items %>
            <p><%= item %></p>
          <% end %>
        `

        const parseResult = Herb.parse(content)
        const collector = new UnreachableCodeCollector()
        collector.visit(parseResult.value)

        expect(collector.diagnostics.length).toBe(0)
      })
    })

    describe("while loops", () => {
      it("detects empty while loop", () => {
        const content = dedent`
          <% while condition %>
          <% end %>
        `

        const parseResult = Herb.parse(content)
        const collector = new UnreachableCodeCollector()
        collector.visit(parseResult.value)

        expect(collector.diagnostics.length).toBe(1)
        expect(collector.diagnostics[0].message).toContain("Empty while block")
      })

      it("does not flag while loop with content", () => {
        const content = dedent`
          <% while condition %>
            <p>Looping</p>
          <% end %>
        `

        const parseResult = Herb.parse(content)
        const collector = new UnreachableCodeCollector()
        collector.visit(parseResult.value)

        expect(collector.diagnostics.length).toBe(0)
      })
    })

    describe("until loops", () => {
      it("detects empty until loop", () => {
        const content = dedent`
          <% until condition %>
          <% end %>
        `

        const parseResult = Herb.parse(content)
        const collector = new UnreachableCodeCollector()
        collector.visit(parseResult.value)

        expect(collector.diagnostics.length).toBe(1)
        expect(collector.diagnostics[0].message).toContain("Empty until block")
      })
    })

    describe("when statements", () => {
      it("detects empty when block", () => {
        const content = dedent`
          <% case value %>
          <% when "a" %>
          <% when "b" %>
            <p>B</p>
          <% end %>
        `

        const parseResult = Herb.parse(content)
        const collector = new UnreachableCodeCollector()
        collector.visit(parseResult.value)

        expect(collector.diagnostics.length).toBe(1)
        expect(collector.diagnostics[0].message).toContain("Empty when block")
      })

      it("does not flag when block with then keyword as empty", () => {
        const content = dedent`
          <% header_error = case %>
          <% when header.blank? then t(".required") %>
          <% when @form.headers.count(header) > 1 then t(".duplicate") %>
          <% end %>
        `

        const parseResult = Herb.parse(content)
        const collector = new UnreachableCodeCollector()
        collector.visit(parseResult.value)

        const whenDiagnostics = collector.diagnostics.filter(d => d.message.includes("Empty when block"))

        expect(whenDiagnostics.length).toBe(0)
      })

      it("does not flag inline when with then as empty", () => {
        const content = dedent`
          <% case variable %>
          <% when String then "string" %>
          <% when Integer then "integer" %>
          <% end %>
        `

        const parseResult = Herb.parse(content)
        const collector = new UnreachableCodeCollector()
        collector.visit(parseResult.value)

        const whenDiagnostics = collector.diagnostics.filter(d => d.message.includes("Empty when block"))
        expect(whenDiagnostics.length).toBe(0)
      })

      it("correctly parses then_keyword location for when clauses", () => {
        const content = dedent`
          <% case value %>
          <% when String then "string" %>
          <% end %>
        `

        const parseResult = Herb.parse(content)
        const caseNode = parseResult.value.children[0] as any
        const whenNode = caseNode.conditions[0]

        expect(whenNode.then_keyword).not.toBeNull()
        expect(whenNode.then_keyword.start.line).toBe(2)
        expect(whenNode.then_keyword.start.column).toBe(15)
      })

      it("does not flag when with then even if then appears in a string", () => {
        const content = dedent`
          <% case value %>
          <% when "then" then "matched then" %>
          <% end %>
        `

        const parseResult = Herb.parse(content)
        const collector = new UnreachableCodeCollector()
        collector.visit(parseResult.value)

        const whenDiagnostics = collector.diagnostics.filter(d => d.message.includes("Empty when block"))
        expect(whenDiagnostics.length).toBe(0)
      })
    })

    describe("begin/rescue/ensure blocks", () => {
      it("detects empty begin block", () => {
        const content = dedent`
          <% begin %>
          <% end %>
        `

        const parseResult = Herb.parse(content)
        const collector = new UnreachableCodeCollector()
        collector.visit(parseResult.value)

        expect(collector.diagnostics.length).toBe(1)
        expect(collector.diagnostics[0].message).toContain("Empty begin block")
      })

      it("detects empty rescue block", () => {
        const content = dedent`
          <% begin %>
            <p>Try this</p>
          <% rescue %>
          <% end %>
        `

        const parseResult = Herb.parse(content)
        const collector = new UnreachableCodeCollector()
        collector.visit(parseResult.value)

        expect(collector.diagnostics.length).toBe(1)
        expect(collector.diagnostics[0].message).toContain("Empty rescue block")
      })

      it("detects empty ensure block", () => {
        const content = dedent`
          <% begin %>
            <p>Try this</p>
          <% ensure %>
          <% end %>
        `

        const parseResult = Herb.parse(content)
        const collector = new UnreachableCodeCollector()
        collector.visit(parseResult.value)

        expect(collector.diagnostics.length).toBe(1)
        expect(collector.diagnostics[0].message).toContain("Empty ensure block")
      })
    })

    describe("in statements", () => {
      it("detects empty in block", () => {
        const content = dedent`
          <% case value %>
          <% in String %>
          <% in Integer %>
            <p>Number</p>
          <% end %>
        `

        const parseResult = Herb.parse(content)
        const collector = new UnreachableCodeCollector()
        collector.visit(parseResult.value)

        expect(collector.diagnostics.length).toBe(1)
        expect(collector.diagnostics[0].message).toContain("Empty in block")
      })

      it("does not flag in block with then keyword as empty", () => {
        const content = dedent`
          <% case value %>
          <% in String then "string" %>
          <% in Integer then "integer" %>
          <% end %>
        `

        const parseResult = Herb.parse(content)
        const collector = new UnreachableCodeCollector()
        collector.visit(parseResult.value)

        const inDiagnostics = collector.diagnostics.filter(d => d.message.includes("Empty in block"))
        expect(inDiagnostics.length).toBe(0)
      })

      it("correctly parses then_keyword location for in clauses", () => {
        const content = dedent`
          <% case value %>
          <% in String then "string" %>
          <% end %>
        `

        const parseResult = Herb.parse(content)
        const caseNode = parseResult.value.children[0] as any
        const inNode = caseNode.conditions[0]

        expect(inNode.then_keyword).not.toBeNull()
        expect(inNode.then_keyword.start.line).toBe(2)
        expect(inNode.then_keyword.start.column).toBe(13)
      })

      it("does not flag in with then even if then appears in pattern", () => {
        const content = dedent`
          <% case value %>
          <% in { then: x } then x %>
          <% end %>
        `

        const parseResult = Herb.parse(content)
        const collector = new UnreachableCodeCollector()
        collector.visit(parseResult.value)

        const inDiagnostics = collector.diagnostics.filter(d => d.message.includes("Empty in block"))
        expect(inDiagnostics.length).toBe(0)
      })
    })

    describe("block statements", () => {
      it("detects empty block", () => {
        const content = dedent`
          <% foo do %>
          <% end %>
        `

        const parseResult = Herb.parse(content)
        const collector = new UnreachableCodeCollector()
        collector.visit(parseResult.value)

        expect(collector.diagnostics.length).toBe(1)
        expect(collector.diagnostics[0].message).toContain("Empty block")
      })

      it("does not flag block with content", () => {
        const content = dedent`
          <% foo do %>
            <p>Content</p>
          <% end %>
        `

        const parseResult = Herb.parse(content)
        const collector = new UnreachableCodeCollector()
        collector.visit(parseResult.value)

        expect(collector.diagnostics.length).toBe(0)
      })
    })

    describe("combined scenarios", () => {
      it("detects multiple empty blocks in same template", () => {
        const content = dedent`
          <% if condition %>
          <% end %>

          <% unless other %>
          <% end %>
        `

        const parseResult = Herb.parse(content)
        const collector = new UnreachableCodeCollector()
        collector.visit(parseResult.value)

        expect(collector.diagnostics.length).toBe(2)
      })

      it("detects empty nested blocks", () => {
        const content = dedent`
          <% if outer %>
            <% if inner %>
            <% end %>
          <% end %>
        `

        const parseResult = Herb.parse(content)
        const collector = new UnreachableCodeCollector()
        collector.visit(parseResult.value)

        expect(collector.diagnostics.length).toBe(1)
        expect(collector.diagnostics[0].message).toContain("Empty if block")
      })
    })
  })
})
