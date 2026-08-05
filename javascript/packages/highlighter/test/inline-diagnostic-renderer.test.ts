import { describe, it, expect, beforeEach } from "vitest"
import dedent from "dedent"

import { themes } from "../src/themes.js"
import { stripAnsiColors } from "./util.js"

import { InlineDiagnosticRenderer } from "../src/inline-diagnostic-renderer.js"
import { SyntaxRenderer } from "../src/syntax-renderer.js"

import type { Diagnostic } from "@herb-tools/core"

describe("InlineDiagnosticRenderer", () => {
  let renderer: InlineDiagnosticRenderer

  beforeEach(async () => {
    const syntaxRenderer = new SyntaxRenderer(themes.onedark)
    await syntaxRenderer.initialize()
    renderer = new InlineDiagnosticRenderer(syntaxRenderer)
  })

  const createDiagnostic = (overrides: Partial<Diagnostic> = {}): Diagnostic => ({
    message: "Test error message",
    severity: "error",
    location: {
      start: { line: 2, column: 5 },
      end: { line: 2, column: 10 },
    },
    code: "test-rule",
    ...overrides,
  })

  const render = (content: string, diagnostics: Diagnostic[], showLineNumbers = true) => {
    return stripAnsiColors(renderer.render("/test/file.erb", content, diagnostics, 2, showLineNumbers, false))
  }

  it("renders a single-line diagnostic with its message under the marker", () => {
    const content = dedent`
      line 1
      line <error> content
      line 3
    `

    expect(render(content, [createDiagnostic()])).toMatchSnapshot()
  })

  it("marks every line a multi-line diagnostic spans", () => {
    const content = dedent`
      <div id="gems">
        <% @gems.each do |topic_gem| %>
          <%= render partial: "gem_card" %>
        <% end %>
      </div>
    `

    const diagnostic = createDiagnostic({
      message: "Multi-line offense",
      severity: "warning",
      code: "multi-line-rule",
      location: {
        start: { line: 2, column: 2 },
        end: { line: 4, column: 11 },
      },
    })

    expect(render(content, [diagnostic])).toMatchSnapshot()
  })

  it("renders the message once, under the last line of a multi-line diagnostic", () => {
    const content = dedent`
      <% if true %>
        <span>content</span>
      <% end %>
    `

    const diagnostic = createDiagnostic({
      message: "Multi-line offense",
      location: {
        start: { line: 1, column: 0 },
        end: { line: 3, column: 9 },
      },
    })

    const result = render(content, [diagnostic])

    expect(result.match(/Multi-line offense/g)).toHaveLength(1)
    expect(result).toMatchSnapshot()
  })

  it("renders markers without line numbers", () => {
    const content = dedent`
      line 1
      line <error> content
      line 3
    `

    expect(render(content, [createDiagnostic()], false)).toMatchSnapshot()
  })
})
