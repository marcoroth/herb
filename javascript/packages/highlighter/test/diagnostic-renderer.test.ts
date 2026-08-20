import { describe, it, expect, beforeEach } from "vitest"
import dedent from "dedent"

import { themes } from "../src/themes.js"
import { ANSI_REGEX } from "../src/ansi.js"
import { stripAnsiColors } from "./util.js"

import { DiagnosticRenderer } from "../src/diagnostic-renderer.js"
import { Herb } from "@herb-tools/node-wasm"
import { SyntaxRenderer } from "../src/syntax-renderer.js"

import { Location } from "@herb-tools/core"

import type { Diagnostic } from "@herb-tools/core"

describe("DiagnosticRenderer", () => {
  let renderer: DiagnosticRenderer
  let syntaxRenderer: SyntaxRenderer

  beforeEach(async () => {
    syntaxRenderer = new SyntaxRenderer(themes.onedark, Herb)
    await syntaxRenderer.initialize()
    renderer = new DiagnosticRenderer(syntaxRenderer)
  })

  const createDiagnostic = (
    overrides: Partial<Diagnostic> = {},
  ): Diagnostic => ({
    message: "Test error message",
    severity: "error",
    location: Location.from(2, 5, 2, 10),
    code: "test-rule",
    ...overrides,
  })

  describe("renderSingle", () => {
    it("should render a single error diagnostic", () => {
      const diagnostic = createDiagnostic()
      const content = dedent`
        line 1
        line <error> content
        line 3
      `
      const result = renderer.renderSingle(
        "/test/file.erb",
        diagnostic,
        content,
      )

      expect(stripAnsiColors(result)).toMatchSnapshot()
    })

    it("should render a single warning diagnostic", () => {
      const diagnostic = createDiagnostic({ severity: "warning" })
      const content = dedent`
        line 1
        line <warn> content
        line 3
      `
      const result = renderer.renderSingle(
        "/test/file.erb",
        diagnostic,
        content,
      )

      expect(stripAnsiColors(result)).toMatchSnapshot()
    })

    it("should handle custom context lines", () => {
      const diagnostic = createDiagnostic({
        location: Location.from(5, 1, 5, 5),
      })
      const content = dedent`
        line 1
        line 2
        line 3
        line 4
        line 5 error
        line 6
        line 7
      `

      const result = renderer.renderSingle(
        "/test/file.erb",
        diagnostic,
        content,
        { contextLines: 1 },
      )

      expect(stripAnsiColors(result)).toMatchSnapshot()
    })

    it("should hide line numbers when requested", () => {
      const diagnostic = createDiagnostic()
      const content = dedent`
        line 1
        line <error> content
        line 3
      `
      const result = renderer.renderSingle(
        "/test/file.erb",
        diagnostic,
        content,
        { showLineNumbers: false },
      )

      expect(stripAnsiColors(result)).toMatchSnapshot()
    })

    it("should handle edge cases for line boundaries", () => {
      const diagnostic = createDiagnostic({
        location: Location.from(1, 1, 1, 5),
      })
      const content = "single line"

      const result = renderer.renderSingle(
        "/test/file.erb",
        diagnostic,
        content,
        { contextLines: 5 },
      )

      expect(stripAnsiColors(result)).toMatchSnapshot()
    })

    it("should highlight backticks in messages", () => {
      const diagnostic = createDiagnostic({
        message: "Error with `code` in message",
      })
      const content = dedent`
        line 1
        line <error> content
        line 3
      `
      const result = renderer.renderSingle(
        "/test/file.erb",
        diagnostic,
        content,
      )

      expect(stripAnsiColors(result)).toMatchSnapshot()
    })

    it("should handle multi-character error ranges", () => {
      const diagnostic = createDiagnostic({
        location: Location.from(2, 5, 2, 15),
      })
      const content = dedent`
        line 1
        line <long error> content
        line 3
      `
      const result = renderer.renderSingle(
        "/test/file.erb",
        diagnostic,
        content,
      )

      expect(stripAnsiColors(result)).toMatchSnapshot()
    })
  })

  describe("error handling", () => {
    it("should handle invalid line numbers gracefully", () => {
      const diagnostic = createDiagnostic({
        location: Location.from(999, 1, 999, 5),
      })
      const content = dedent`
        line 1
        line 2
      `

      const result = renderer.renderSingle(
        "/test/file.erb",
        diagnostic,
        content,
      )

      expect(stripAnsiColors(result)).toMatchSnapshot()
    })

    it("should handle invalid column numbers gracefully", () => {
      const diagnostic = createDiagnostic({
        location: Location.from(2, 999, 2, 1000),
      })
      const content = dedent`
        line 1
        short
        line 3
      `

      const result = renderer.renderSingle(
        "/test/file.erb",
        diagnostic,
        content,
      )

      expect(stripAnsiColors(result)).toMatchSnapshot()
    })
  })

  describe("multi-line diagnostics", () => {
    const multiLineContent = dedent`
      <div>

        <div id="gems">
          <% @gems.each do |topic_gem| %>
            <%= render partial: "gem_card" %>
          <% end %>
        </div>

      </div>
    `

    const multiLineDiagnostic = createDiagnostic({
      message: "Multi-line offense",
      severity: "warning",
      location: Location.from(4, 4, 6, 13),
      code: "multi-line-rule",
    })

    it("marks every line the diagnostic spans and expands the trailing context off the end line", () => {
      const result = renderer.renderSingle("/test/file.erb", multiLineDiagnostic, multiLineContent, {
        wrapLines: false,
        contextLines: 2,
      })

      expect(stripAnsiColors(result)).toMatchSnapshot()
    })

    it("does not mark blank lines inside the span", () => {
      const content = dedent`
        <% if true %>

        <% end %>
      `

      const diagnostic = createDiagnostic({
        location: Location.from(1, 0, 3, 9),
      })

      const result = renderer.renderSingle("/test/file.erb", diagnostic, content, { wrapLines: false })

      expect(stripAnsiColors(result)).toMatchSnapshot()
    })

    it("aligns markers to the content when line numbers are hidden", () => {
      const result = renderer.renderSingle("/test/file.erb", multiLineDiagnostic, multiLineContent, {
        wrapLines: false,
        contextLines: 2,
        showLineNumbers: false,
      })

      expect(stripAnsiColors(result)).toMatchSnapshot()
    })

    it("keeps a single marker for single-line diagnostics", () => {
      const content = dedent`
        line 1
        line <error> content
        line 3
      `
      const result = renderer.renderSingle("/test/file.erb", createDiagnostic(), content, { wrapLines: false })

      expect(stripAnsiColors(result)).toMatchSnapshot()
    })
  })

  describe("smart diagnostic truncation", () => {
    it("should show ellipsis at end when diagnostic is at start of long line", () => {
      const longLineStart = `<div class="this-is-a-very-long-class-name-that-should-be-truncated-when-the-line-is-too-long">Content</div>`

      const diagnostic = createDiagnostic({
        message: "Class name should be shorter",
        location: Location.from(1, 13, 1, 33),
        code: "class-name-length"
      })

      const result = renderer.renderSingle(
        "/test/file.erb",
        diagnostic,
        longLineStart,
        {
          truncateLines: true,
          maxWidth: 60
        }
      )

      expect(stripAnsiColors(result)).toMatchSnapshot()
    })

    it("should show ellipsis at beginning when diagnostic is at end of long line", () => {
      const longLineEnd = `<div class="this-is-a-very-long-class-name-that-should-be-truncated-when-the-line-is-too-long">Content</div>`

      const diagnostic = createDiagnostic({
        message: "Content should be more descriptive",
        severity: "warning",
        location: Location.from(1, 95, 1, 102),
        code: "content-description"
      })

      const result = renderer.renderSingle(
        "/test/file.erb",
        diagnostic,
        longLineEnd,
        {
          truncateLines: true,
          maxWidth: 60
        }
      )

      expect(stripAnsiColors(result)).toMatchSnapshot()
    })

    it("should show ellipsis on both sides when diagnostic is in middle of long line", () => {
      const longLineMiddle = `<div class="this-is-a-very-long-class-name-that-should-be-truncated-when-the-line-is-too-long-with-more-content">Content</div>`

      const diagnostic = createDiagnostic({
        message: "Avoid 'should-be' in class names",
        location: Location.from(1, 45, 1, 54),
        code: "class-naming-convention"
      })

      const result = renderer.renderSingle(
        "/test/file.erb",
        diagnostic,
        longLineMiddle,
        {
          truncateLines: true,
          maxWidth: 60
        }
      )

      expect(stripAnsiColors(result)).toMatchSnapshot()
    })

    it("should adjust pointer position correctly for truncated diagnostics", () => {
      const longLine = `<div class="this-is-a-very-long-class-name-that-should-be-truncated">Content</div>`

      const diagnostic = createDiagnostic({
        message: "Test diagnostic positioning",
        location: Location.from(1, 50, 1, 55),
        code: "test-positioning"
      })

      const result = renderer.renderSingle(
        "/test/file.erb",
        diagnostic,
        longLine,
        {
          truncateLines: true,
          maxWidth: 40
        }
      )

      expect(stripAnsiColors(result)).toMatchSnapshot()
    })

    it("should handle truncation with context lines", () => {
      const content = dedent`
        <div class="short-line">Short</div>
        <div class="this-is-a-very-long-class-name-that-should-be-truncated-when-the-line-is-too-long">Content</div>
        <div class="another-short-line">Short</div>
      `

      const diagnostic = createDiagnostic({
        message: "Long class name detected",
        location: Location.from(2, 13, 2, 30), // Points to long class name
        code: "class-name-length"
      })

      const result = renderer.renderSingle(
        "/test/file.erb",
        diagnostic,
        content,
        {
          truncateLines: true,
          maxWidth: 60,
          contextLines: 1
        }
      )

      expect(stripAnsiColors(result)).toMatchSnapshot()
    })

    it("should not truncate when maxWidth is sufficient", () => {
      const shortLine = `<div class="short">Content</div>`

      const diagnostic = createDiagnostic({
        message: "Test short line",
        location: Location.from(1, 13, 1, 18),
        code: "test-short"
      })

      const result = renderer.renderSingle(
        "/test/file.erb",
        diagnostic,
        shortLine,
        {
          truncateLines: true,
          maxWidth: 100
        }
      )

      const strippedResult = stripAnsiColors(result)

      expect(strippedResult).not.toContain("…")
      expect(strippedResult).toMatchSnapshot()
    })
  })

  describe("ANSI-aware truncation preserves styling", () => {
    it("should preserve syntax highlighting colors in truncated output", () => {
      const content = `<div class="this-is-a-very-long-class-name-that-should-be-truncated-when-the-line-is-too-long">Content</div>`

      const diagnostic = createDiagnostic({
        message: "Line too long",
        location: Location.from(1, 1, 1, 5),
        code: "line-length",
      })

      const result = renderer.renderSingle(
        "/test/file.erb",
        diagnostic,
        content,
        { truncateLines: true, maxWidth: 50 },
      )

      expect(result).toMatch(ANSI_REGEX)
      expect(result).toMatchSnapshot()
    })

    it("should preserve colors when extracting from end of styled line", () => {
      const content = `<div class="this-is-a-very-long-class-name-that-should-be-truncated-when-the-line-is-too-long">ShortEnd</div>`

      const diagnostic = createDiagnostic({
        message: "End content issue",
        location: Location.from(1, 95, 1, 103),
        code: "end-content",
      })

      const result = renderer.renderSingle(
        "/test/file.erb",
        diagnostic,
        content,
        { truncateLines: true, maxWidth: 50 },
      )

      expect(result).toMatch(ANSI_REGEX)
      expect(result).toMatchSnapshot()
    })

    it("should preserve colors when extracting from middle of styled line", () => {
      const content = `<div class="aaaaaaaaaaaaaaaa-MIDDLE_TARGET-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb">end</div>`

      const diagnostic = createDiagnostic({
        message: "Middle issue",
        location: Location.from(1, 30, 1, 44),
        code: "middle-content",
      })

      const result = renderer.renderSingle(
        "/test/file.erb",
        diagnostic,
        content,
        { truncateLines: true, maxWidth: 50 },
      )

      expect(result).toMatch(ANSI_REGEX)
      expect(result).toMatchSnapshot()
    })
  })

  describe("NO_COLOR environment", () => {
    it("should respect NO_COLOR environment variable", () => {
      const originalNoColor = process.env.NO_COLOR
      process.env.NO_COLOR = "1"

      try {
        const diagnostic = createDiagnostic()
        const content = dedent`
          line 1
          line <error> content
          line 3
        `
        const result = renderer.renderSingle(
          "/test/file.erb",
          diagnostic,
          content,
        )

        expect(result).not.toMatch(ANSI_REGEX)
        expect(result).toMatchSnapshot()
      } finally {
        if (originalNoColor === undefined) {
          delete process.env.NO_COLOR
        } else {
          process.env.NO_COLOR = originalNoColor
        }
      }
    })
  })
})
