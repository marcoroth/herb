import { describe, it, expect, beforeEach } from "vitest"

import { themes } from "../src/themes.js"
import { ANSI_REGEX } from "../src/color.js"
import { stripAnsiColors } from "./util.js"

import { DiagnosticRenderer } from "../src/diagnostic-renderer.js"
import { SyntaxRenderer } from "../src/syntax-renderer.js"

import type { Diagnostic } from "@herb-tools/core"

describe("DiagnosticRenderer", () => {
  let renderer: DiagnosticRenderer
  let syntaxRenderer: SyntaxRenderer

  beforeEach(async () => {
    syntaxRenderer = new SyntaxRenderer(themes.onedark)
    await syntaxRenderer.initialize()
    renderer = new DiagnosticRenderer(syntaxRenderer)
  })

  const createDiagnostic = (
    overrides: Partial<Diagnostic> = {},
  ): Diagnostic => ({
    message: "Test error message",
    severity: "error",
    location: {
      start: { line: 2, column: 5 },
      end: { line: 2, column: 10 },
    },
    code: "test-rule",
    ...overrides,
  })

  describe("renderSingle", () => {
    it("should render a single error diagnostic", () => {
      const diagnostic = createDiagnostic()
      const content = "line 1\nline <error> content\nline 3"
      const result = renderer.renderSingle(
        "/test/file.erb",
        diagnostic,
        content,
      )

      expect(result).toMatch(/\[.*error.*\]/)
      expect(result).toContain("Test error message")
      expect(result).toContain("test-rule")
      expect(result).toMatch(/\/test\/file\.erb.*2:5/)
      expect(result).toContain("→")
      expect(result).toMatch(/~{5}/)
    })

    it("should render a single warning diagnostic", () => {
      const diagnostic = createDiagnostic({ severity: "warning" })
      const content = "line 1\nline <warn> content\nline 3"
      const result = renderer.renderSingle(
        "/test/file.erb",
        diagnostic,
        content,
      )

      expect(result).toMatch(/\[.*warning.*\]/)
      expect(result).toContain("Test error message")
      expect(result).toContain("test-rule")
    })

    it("should handle custom context lines", () => {
      const diagnostic = createDiagnostic({
        location: {
          start: { line: 5, column: 1 },
          end: { line: 5, column: 5 },
        },
      })
      const content =
        "line 1\nline 2\nline 3\nline 4\nline 5 error\nline 6\nline 7"

      const result = renderer.renderSingle(
        "/test/file.erb",
        diagnostic,
        content,
        { contextLines: 1 },
      )

      expect(result).toMatch(/line.*4/)
      expect(result).toMatch(/line.*5.*error/)
      expect(result).toMatch(/line.*6/)
      expect(result).not.toMatch(/\s+3\s+│/)
      expect(result).not.toMatch(/\s+7\s+│/)
    })

    it("should hide line numbers when requested", () => {
      const diagnostic = createDiagnostic()
      const content = "line 1\nline <error> content\nline 3"
      const result = renderer.renderSingle(
        "/test/file.erb",
        diagnostic,
        content,
        { showLineNumbers: false },
      )

      expect(result).not.toMatch(/\d+\s*│/)
      expect(result).toContain("Test error message")
    })

    it("should handle edge cases for line boundaries", () => {
      const diagnostic = createDiagnostic({
        location: {
          start: { line: 1, column: 1 },
          end: { line: 1, column: 5 },
        },
      })
      const content = "single line"

      const result = renderer.renderSingle(
        "/test/file.erb",
        diagnostic,
        content,
        { contextLines: 5 },
      )

      expect(result).toMatch(/single.*line/)
      expect(result).toContain("→")
    })

    it("should highlight backticks in messages", () => {
      const diagnostic = createDiagnostic({
        message: "Error with `code` in message",
      })
      const content = "line 1\nline <error> content\nline 3"
      const result = renderer.renderSingle(
        "/test/file.erb",
        diagnostic,
        content,
      )

      expect(result).toContain("`code`")
    })

    it("should handle multi-character error ranges", () => {
      const diagnostic = createDiagnostic({
        location: {
          start: { line: 2, column: 5 },
          end: { line: 2, column: 15 },
        },
      })
      const content = "line 1\nline <long error> content\nline 3"
      const result = renderer.renderSingle(
        "/test/file.erb",
        diagnostic,
        content,
      )

      expect(result).toMatch(/~{10}/)
    })
  })

  describe("error handling", () => {
    it("should handle invalid line numbers gracefully", () => {
      const diagnostic = createDiagnostic({
        location: {
          start: { line: 999, column: 1 },
          end: { line: 999, column: 5 },
        },
      })
      const content = "line 1\nline 2"

      const result = renderer.renderSingle(
        "/test/file.erb",
        diagnostic,
        content,
      )

      expect(result).toContain("Test error message")
      expect(result).toContain("test-rule")
    })

    it("should handle invalid column numbers gracefully", () => {
      const diagnostic = createDiagnostic({
        location: {
          start: { line: 2, column: 999 },
          end: { line: 2, column: 1000 },
        },
      })
      const content = "line 1\nshort\nline 3"

      const result = renderer.renderSingle(
        "/test/file.erb",
        diagnostic,
        content,
      )

      expect(result).toContain("Test error message")
      expect(result).toContain("short")
    })
  })

  describe("smart diagnostic truncation", () => {
    it("should show ellipsis at end when diagnostic is at start of long line", () => {
      const longLineStart = `<div class="this-is-a-very-long-class-name-that-should-be-truncated-when-the-line-is-too-long">Content</div>`

      const diagnostic = createDiagnostic({
        message: "Class name should be shorter",
        location: {
          start: { line: 1, column: 13 },
          end: { line: 1, column: 33 }
        },
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

      const strippedResult = stripAnsiColors(result)

      expect(strippedResult).toContain("…")
      expect(strippedResult).toContain("this-is-a-very-long")
      expect(strippedResult).not.toContain("Content</div>")
      expect(result).toContain("Class name should be shorter")
    })

    it("should show ellipsis at beginning when diagnostic is at end of long line", () => {
      const longLineEnd = `<div class="this-is-a-very-long-class-name-that-should-be-truncated-when-the-line-is-too-long">Content</div>`

      const diagnostic = createDiagnostic({
        message: "Content should be more descriptive",
        severity: "warning",
        location: {
          start: { line: 1, column: 95 },
          end: { line: 1, column: 102 }
        },
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

      const strippedResult = stripAnsiColors(result)

      expect(strippedResult).toContain("…")
      expect(strippedResult).toContain("Content")
      expect(strippedResult).not.toContain("this-is-a-very-long")
      expect(result).toContain("Content should be more descriptive")
    })

    it("should show ellipsis on both sides when diagnostic is in middle of long line", () => {
      const longLineMiddle = `<div class="this-is-a-very-long-class-name-that-should-be-truncated-when-the-line-is-too-long-with-more-content">Content</div>`

      const diagnostic = createDiagnostic({
        message: "Avoid 'should-be' in class names",
        location: {
          start: { line: 1, column: 45 },
          end: { line: 1, column: 54 }
        },
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

      const strippedResult = stripAnsiColors(result)

      const ellipsisCount = (strippedResult.match(/…/g) || []).length
      expect(ellipsisCount).toBeGreaterThanOrEqual(2)
      expect(strippedResult).toContain("should-be")
      expect(strippedResult).not.toContain("this-is-a-very")
      expect(strippedResult).not.toContain("Content</div>")
      expect(result).toContain("Avoid 'should-be' in class names")
    })

    it("should adjust pointer position correctly for truncated diagnostics", () => {
      const longLine = `<div class="this-is-a-very-long-class-name-that-should-be-truncated">Content</div>`

      const diagnostic = createDiagnostic({
        message: "Test diagnostic positioning",
        location: {
          start: { line: 1, column: 50 },
          end: { line: 1, column: 55 }
        },
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

      expect(result).toMatch(/~{5}/)
      expect(result).toContain("…")
    })

    it("should handle truncation with context lines", () => {
      const content = `<div class="short-line">Short</div>
<div class="this-is-a-very-long-class-name-that-should-be-truncated-when-the-line-is-too-long">Content</div>
<div class="another-short-line">Short</div>`

      const diagnostic = createDiagnostic({
        message: "Long class name detected",
        location: {
          start: { line: 2, column: 13 }, // Points to long class name
          end: { line: 2, column: 30 }
        },
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

      const strippedResult = stripAnsiColors(result)

      expect(strippedResult).toContain("short-line")
      expect(strippedResult).toContain("another-short-line")
      expect(strippedResult).toContain("…")
      expect(result).toContain("Long class name detected")
    })

    it("should not truncate when maxWidth is sufficient", () => {
      const shortLine = `<div class="short">Content</div>`

      const diagnostic = createDiagnostic({
        message: "Test short line",
        location: {
          start: { line: 1, column: 13 },
          end: { line: 1, column: 18 }
        },
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
      expect(strippedResult).toContain("short")
      expect(strippedResult).toContain("Content")
    })
  })

  describe("ANSI-aware truncation preserves styling", () => {
    it("should preserve syntax highlighting colors in truncated output", () => {
      const content = `<div class="this-is-a-very-long-class-name-that-should-be-truncated-when-the-line-is-too-long">Content</div>`

      const diagnostic = createDiagnostic({
        message: "Line too long",
        location: {
          start: { line: 1, column: 1 },
          end: { line: 1, column: 5 },
        },
        code: "line-length",
      })

      const result = renderer.renderSingle(
        "/test/file.erb",
        diagnostic,
        content,
        { truncateLines: true, maxWidth: 50 },
      )

      expect(result).toMatch(ANSI_REGEX)
      const strippedResult = stripAnsiColors(result)
      expect(strippedResult).toContain("…")
    })

    it("should preserve colors when extracting from end of styled line", () => {
      const content = `<div class="this-is-a-very-long-class-name-that-should-be-truncated-when-the-line-is-too-long">ShortEnd</div>`

      const diagnostic = createDiagnostic({
        message: "End content issue",
        location: {
          start: { line: 1, column: 95 },
          end: { line: 1, column: 103 },
        },
        code: "end-content",
      })

      const result = renderer.renderSingle(
        "/test/file.erb",
        diagnostic,
        content,
        { truncateLines: true, maxWidth: 50 },
      )

      const strippedResult = stripAnsiColors(result)
      expect(strippedResult).toContain("ShortEnd")
      expect(result).toMatch(ANSI_REGEX)
    })

    it("should preserve colors when extracting from middle of styled line", () => {
      const content = `<div class="aaaaaaaaaaaaaaaa-MIDDLE_TARGET-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb">end</div>`

      const diagnostic = createDiagnostic({
        message: "Middle issue",
        location: {
          start: { line: 1, column: 30 },
          end: { line: 1, column: 44 },
        },
        code: "middle-content",
      })

      const result = renderer.renderSingle(
        "/test/file.erb",
        diagnostic,
        content,
        { truncateLines: true, maxWidth: 50 },
      )

      const strippedResult = stripAnsiColors(result)
      expect(strippedResult).toContain("MIDDLE_TARGET")
      expect(result).toMatch(ANSI_REGEX)
    })
  })

  describe("NO_COLOR environment", () => {
    it("should respect NO_COLOR environment variable", () => {
      const originalNoColor = process.env.NO_COLOR
      process.env.NO_COLOR = "1"

      try {
        const diagnostic = createDiagnostic()
        const content = "line 1\nline <error> content\nline 3"
        const result = renderer.renderSingle(
          "/test/file.erb",
          diagnostic,
          content,
        )

        expect(result).not.toMatch(ANSI_REGEX)
        expect(result).toContain("Test error message")
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
