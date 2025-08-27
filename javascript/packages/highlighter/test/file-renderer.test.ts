import { describe, it, expect, beforeEach } from "vitest"

import { themes } from "../src/themes.js"
import { stripAnsiColors } from "./util.js"

import { FileRenderer } from "../src/file-renderer.js"
import { SyntaxRenderer } from "../src/syntax-renderer.js"

describe("FileRenderer", () => {
  let renderer: FileRenderer
  let syntaxRenderer: SyntaxRenderer

  beforeEach(async () => {
    syntaxRenderer = new SyntaxRenderer(themes.onedark)
    await syntaxRenderer.initialize()
    renderer = new FileRenderer(syntaxRenderer)
  })

  describe("renderWithLineNumbers", () => {
    it("should render content with line numbers", () => {
      const content = "line 1\nline 2\nline 3"
      const result = renderer.renderWithLineNumbers("/test/file.erb", content)

      expect(stripAnsiColors(result)).toContain("/test/file.erb")
      expect(stripAnsiColors(result)).toContain("  1 │ line 1")
      expect(stripAnsiColors(result)).toContain("  2 │ line 2")
      expect(stripAnsiColors(result)).toContain("  3 │ line 3")
    })

    it("should handle single line content", () => {
      const content = "single line"
      const result = renderer.renderWithLineNumbers("/test/file.erb", content)

      expect(stripAnsiColors(result)).toContain("/test/file.erb")
      expect(stripAnsiColors(result)).toContain("  1 │ single line")
    })

    it("should handle empty content", () => {
      const content = ""
      const result = renderer.renderWithLineNumbers("/test/file.erb", content)

      expect(stripAnsiColors(result)).toContain("/test/file.erb")
      expect(stripAnsiColors(result)).toContain("  1 │")
    })

    it("should handle content with empty lines", () => {
      const content = "line 1\n\nline 3"
      const result = renderer.renderWithLineNumbers("/test/file.erb", content)

      expect(stripAnsiColors(result)).toContain("1 │ line 1")
      expect(stripAnsiColors(result)).toContain("  2 │")
      expect(stripAnsiColors(result)).toContain("3 │ line 3")
    })

    it("should apply syntax highlighting", () => {
      const content = "<div>Hello</div>"
      const result = renderer.renderWithLineNumbers("/test/file.erb", content)

      expect(stripAnsiColors(result)).toContain("/test/file.erb")
      expect(stripAnsiColors(result)).toContain("div")
      expect(stripAnsiColors(result)).toContain("Hello")
    })
  })

  describe("renderWithFocusLine", () => {
    it("should highlight focus line and dim others", () => {
      const content = "line 1\nline 2\nline 3\nline 4\nline 5"
      const result = renderer.renderWithFocusLine(
        "/test/file.erb",
        content,
        3,
        1,
        true,
      )

      expect(stripAnsiColors(result)).toContain("/test/file.erb")
      expect(stripAnsiColors(result)).toContain("→") // Focus line indicator
      expect(stripAnsiColors(result)).toContain("  2 │") // Context line above
      expect(stripAnsiColors(result)).toContain("  3 │") // Focus line
      expect(stripAnsiColors(result)).toContain("4 │") // Context line below
      expect(stripAnsiColors(result)).not.toContain("1 │") // Outside context
      expect(stripAnsiColors(result)).not.toContain("5 │") // Outside context
    })

    it("should handle focus line at beginning of file", () => {
      const content = "line 1\nline 2\nline 3"
      const result = renderer.renderWithFocusLine(
        "/test/file.erb",
        content,
        1,
        1,
        true,
      )

      expect(stripAnsiColors(result)).toContain("  1 │") // Focus line
      expect(stripAnsiColors(result)).toContain("  2 │") // Context line
      expect(stripAnsiColors(result)).not.toContain("3 │") // Outside context
    })

    it("should handle focus line at end of file", () => {
      const content = "line 1\nline 2\nline 3"
      const result = renderer.renderWithFocusLine(
        "/test/file.erb",
        content,
        3,
        1,
        true,
      )

      expect(stripAnsiColors(result)).toContain("  2 │") // Context line
      expect(stripAnsiColors(result)).toContain("  3 │") // Focus line
      expect(stripAnsiColors(result)).not.toContain("1 │") // Outside context
    })

    it("should handle large context that exceeds file bounds", () => {
      const content = "line 1\nline 2"
      const result = renderer.renderWithFocusLine(
        "/test/file.erb",
        content,
        1,
        10,
        true,
      )

      expect(stripAnsiColors(result)).toContain("  1 │") // Focus line
      expect(stripAnsiColors(result)).toContain("  2 │") // All available context
    })

    it("should work without line numbers", () => {
      const content = "line 1\nline 2\nline 3"
      const result = renderer.renderWithFocusLine(
        "/test/file.erb",
        content,
        2,
        1,
        false,
      )

      expect(stripAnsiColors(result)).not.toContain("/test/file.erb") // No file header
      expect(stripAnsiColors(result)).not.toMatch(/\d+ │/) // No line numbers
      expect(stripAnsiColors(result)).toContain("line 1")
      expect(stripAnsiColors(result)).toContain("line 2")
      expect(stripAnsiColors(result)).toContain("line 3")
    })

    it("should apply syntax highlighting", () => {
      const content = "<div>line 1</div>\n<span>line 2</span>\n<p>line 3</p>"
      const result = renderer.renderWithFocusLine(
        "/test/file.erb",
        content,
        2,
        1,
        true,
      )

      expect(stripAnsiColors(result)).toContain("div")
      expect(stripAnsiColors(result)).toContain("span")
      expect(stripAnsiColors(result)).toContain("→") // Focus line indicator
    })
  })

  describe("renderPlain", () => {
    it("should render content without line numbers or file headers", () => {
      const content = "line 1\nline 2\nline 3"
      const result = renderer.renderPlain(content)

      expect(stripAnsiColors(result)).not.toContain("│") // No line separators
      expect(stripAnsiColors(result)).not.toMatch(/\s+\d+\s*│/) // No line numbers
      expect(stripAnsiColors(result)).toContain("line 1")
      expect(stripAnsiColors(result)).toContain("line 2")
      expect(stripAnsiColors(result)).toContain("line 3")
    })

    it("should apply syntax highlighting", () => {
      const content = "<div>Hello World</div>"
      const result = renderer.renderPlain(content)

      expect(stripAnsiColors(result)).toContain("div")
      expect(stripAnsiColors(result)).toContain("Hello World")
    })

    it("should handle empty content", () => {
      const content = ""
      const result = renderer.renderPlain(content)

      expect(result).toBe("")
    })

    it("should preserve exact content structure", () => {
      const content = "line 1\n\nline 3\n    indented line"
      const result = renderer.renderPlain(content)

      expect(stripAnsiColors(result)).toContain("line 1\n\nline 3\n    indented line")
    })
  })

  describe("theme support", () => {
    it("should work with different themes", async () => {
      const githubLightSyntaxRenderer = new SyntaxRenderer(themes["github-light"])
      await githubLightSyntaxRenderer.initialize()
      const githubLightFileRenderer = new FileRenderer(githubLightSyntaxRenderer)

      const content = "<div>test</div>"
      const result = githubLightFileRenderer.renderWithLineNumbers(
        "/test/file.erb",
        content,
      )

      expect(stripAnsiColors(result)).toContain("/test/file.erb")
      expect(stripAnsiColors(result)).toContain("div")
    })

    it("should work with simple theme", async () => {
      const simpleSyntaxRenderer = new SyntaxRenderer(themes.simple)
      await simpleSyntaxRenderer.initialize()
      const simpleFileRenderer = new FileRenderer(simpleSyntaxRenderer)

      const content = "<span>test</span>"
      const result = simpleFileRenderer.renderPlain(content)

      expect(stripAnsiColors(result)).toContain("span")
      expect(stripAnsiColors(result)).toContain("test")
    })
  })

  describe("line truncation", () => {
    it("should truncate long lines with ellipsis", () => {
      const longContent = "This is a very long line that should be truncated when it exceeds the maximum width limit"
      const result = renderer.renderWithLineNumbers("/test/file.erb", longContent, false, 50, true)

      const strippedResult = stripAnsiColors(result)
      expect(strippedResult).toContain("…")
      expect(strippedResult).not.toContain("maximum width limit") // This part should be cut off
    })

    it("should truncate lines in renderPlain method", () => {
      const longContent = "This is another very long line that should be truncated when using renderPlain method"
      const result = renderer.renderPlain(longContent, 50, false, true)

      const strippedResult = stripAnsiColors(result)
      expect(strippedResult).toContain("…")
      expect(strippedResult).not.toContain("renderPlain method") // This part should be cut off
    })

    it("should not truncate lines shorter than maxWidth", () => {
      const shortContent = "Short line"
      const result = renderer.renderWithLineNumbers("/test/file.erb", shortContent, false, 50, true)

      const strippedResult = stripAnsiColors(result)
      expect(strippedResult).not.toContain("…")
      expect(strippedResult).toContain("Short line")
    })
  })

  describe("NO_COLOR environment", () => {
    it("should respect NO_COLOR environment variable", () => {
      const originalNoColor = process.env.NO_COLOR
      process.env.NO_COLOR = "1"

      try {
        const content = "<div>test</div>"
        const result = renderer.renderWithLineNumbers("/test/file.erb", content)

        // Should not contain ANSI escape codes (except for structure)
        expect(stripAnsiColors(result)).toContain("/test/file.erb")
        expect(stripAnsiColors(result)).toContain("div")
        expect(stripAnsiColors(result)).toContain("test")
      } finally {
        if (originalNoColor === undefined) {
          delete process.env.NO_COLOR
        } else {
          process.env.NO_COLOR = originalNoColor
        }
      }
    })
  })

  describe("edge cases", () => {
    it("should handle very long lines", () => {
      const longLine = "a".repeat(1000)
      const content = `short line\n${longLine}\nshort line`
      const result = renderer.renderWithLineNumbers("/test/file.erb", content)

      expect(stripAnsiColors(result)).toContain("short line")
      expect(stripAnsiColors(result)).toContain(longLine)
    })

    it("should handle special characters", () => {
      const content = `line with\ttabs\nline with "quotes"\nline with "single quotes"`
      const result = renderer.renderWithLineNumbers("/test/file.erb", content)

      expect(stripAnsiColors(result)).toContain("tabs")
      expect(stripAnsiColors(result)).toContain(`quotes"`)
      expect(stripAnsiColors(result)).toContain('"single quotes"')
    })

    it("should handle unicode characters", () => {
      const content = "Unicode: 🎉 émojis and àccénts"
      const result = renderer.renderWithLineNumbers("/test/file.erb", content)

      expect(stripAnsiColors(result)).toContain("🎉")
      expect(stripAnsiColors(result)).toContain("émojis")
      expect(stripAnsiColors(result)).toContain("àccénts")
    })
  })
})
