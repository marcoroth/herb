import { describe, it, expect, beforeEach } from "vitest"

import { themes } from "../src/themes.js"

import { DiagnosticRenderer } from "../src/diagnostic-renderer.js"
import { SyntaxRenderer } from "../src/syntax-renderer.js"

import type { Diagnostic } from "@herb-tools/core"

describe("DiagnosticRenderer", () => {
  let renderer: DiagnosticRenderer
  let syntaxRenderer: SyntaxRenderer

  beforeEach(async () => {
    syntaxRenderer = new SyntaxRenderer(themes.default)
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
    id: "test-rule",
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
      expect(result).toMatch(/~{5}/) // Error pointer
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

      // Should show line 4, 5, 6 (target line 5 with 1 context line each side)
      expect(result).toMatch(/line.*4/)
      expect(result).toMatch(/line.*5.*error/)
      expect(result).toMatch(/line.*6/)
      // Check for specific line numbers in the left margin rather than content
      expect(result).not.toMatch(/\s+3\s+│/) // Line number 3 should not appear
      expect(result).not.toMatch(/\s+7\s+│/) // Line number 7 should not appear
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

      // Should not contain line number formatting
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

      // Should handle context lines that exceed file boundaries
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

      // Should have pointer with correct length
      expect(result).toMatch(/~{10}/) // 10 characters
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

      // Should not crash and should still show the diagnostic
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

        // Should not contain ANSI escape codes
        expect(result).not.toMatch(/\x1b\\[[0-9;]*m/)
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
