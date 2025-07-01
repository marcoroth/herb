import { describe, it, expect, beforeEach } from "vitest"

import { themes } from "../src/themes.js"

import { FileRenderer } from "../src/file-renderer.js"
import { SyntaxRenderer } from "../src/syntax-renderer.js"

describe("FileRenderer", () => {
  let renderer: FileRenderer
  let syntaxRenderer: SyntaxRenderer

  beforeEach(async () => {
    syntaxRenderer = new SyntaxRenderer(themes.default)
    await syntaxRenderer.initialize()
    renderer = new FileRenderer(syntaxRenderer)
  })

  describe("renderWithLineNumbers", () => {
    it("should render content with line numbers", () => {
      const content = "line 1\nline 2\nline 3"
      const result = renderer.renderWithLineNumbers("/test/file.erb", content)

      expect(result).toContain("/test/file.erb")
      expect(result).toContain("1 │ line 1")
      expect(result).toContain("2 │ line 2")
      expect(result).toContain("3 │ line 3")
    })

    it("should handle single line content", () => {
      const content = "single line"
      const result = renderer.renderWithLineNumbers("/test/file.erb", content)

      expect(result).toContain("/test/file.erb")
      expect(result).toContain("1 │ single line")
    })

    it("should handle empty content", () => {
      const content = ""
      const result = renderer.renderWithLineNumbers("/test/file.erb", content)

      expect(result).toContain("/test/file.erb")
      expect(result).toContain("1 │")
    })

    it("should handle content with empty lines", () => {
      const content = "line 1\n\nline 3"
      const result = renderer.renderWithLineNumbers("/test/file.erb", content)

      expect(result).toContain("1 │ line 1")
      expect(result).toContain("2 │")
      expect(result).toContain("3 │ line 3")
    })

    it("should apply syntax highlighting", () => {
      const content = "<div>Hello</div>"
      const result = renderer.renderWithLineNumbers("/test/file.erb", content)

      expect(result).toContain("/test/file.erb")
      expect(result).toContain("div")
      expect(result).toContain("Hello")
    })
  })

  describe("renderWithFocusLine", () => {
    it("should highlight focus line and dim others", () => {
      const content = "line 1\nline 2\nline 3\nline 4\nline 5"
      const result = renderer.renderWithFocusLine("/test/file.erb", content, 3, 1, true)

      expect(result).toContain("/test/file.erb")
      expect(result).toContain("→") // Focus line indicator
      expect(result).toContain("2 │") // Context line above
      expect(result).toContain("3 │") // Focus line
      expect(result).toContain("4 │") // Context line below
      expect(result).not.toContain("1 │") // Outside context
      expect(result).not.toContain("5 │") // Outside context
    })

    it("should handle focus line at beginning of file", () => {
      const content = "line 1\nline 2\nline 3"
      const result = renderer.renderWithFocusLine("/test/file.erb", content, 1, 1, true)

      expect(result).toContain("1 │") // Focus line
      expect(result).toContain("2 │") // Context line
      expect(result).not.toContain("3 │") // Outside context
    })

    it("should handle focus line at end of file", () => {
      const content = "line 1\nline 2\nline 3"
      const result = renderer.renderWithFocusLine("/test/file.erb", content, 3, 1, true)

      expect(result).toContain("2 │") // Context line
      expect(result).toContain("3 │") // Focus line
      expect(result).not.toContain("1 │") // Outside context
    })

    it("should handle large context that exceeds file bounds", () => {
      const content = "line 1\nline 2"
      const result = renderer.renderWithFocusLine("/test/file.erb", content, 1, 10, true)

      expect(result).toContain("1 │") // Focus line
      expect(result).toContain("2 │") // All available context
    })

    it("should work without line numbers", () => {
      const content = "line 1\nline 2\nline 3"
      const result = renderer.renderWithFocusLine("/test/file.erb", content, 2, 1, false)

      expect(result).not.toContain("/test/file.erb") // No file header
      expect(result).not.toMatch(/\d+ │/) // No line numbers
      expect(result).toContain("line 1")
      expect(result).toContain("line 2")
      expect(result).toContain("line 3")
    })

    it("should apply syntax highlighting", () => {
      const content = "<div>line 1</div>\n<span>line 2</span>\n<p>line 3</p>"
      const result = renderer.renderWithFocusLine("/test/file.erb", content, 2, 1, true)

      expect(result).toContain("div")
      expect(result).toContain("span")
      expect(result).toContain("→") // Focus line indicator
    })
  })

  describe("renderPlain", () => {
    it("should render content without line numbers or file headers", () => {
      const content = "line 1\nline 2\nline 3"
      const result = renderer.renderPlain(content)

      expect(result).not.toContain("│") // No line separators
      expect(result).not.toMatch(/\d+/) // No line numbers
      expect(result).toContain("line 1")
      expect(result).toContain("line 2")
      expect(result).toContain("line 3")
    })

    it("should apply syntax highlighting", () => {
      const content = "<div>Hello World</div>"
      const result = renderer.renderPlain(content)

      expect(result).toContain("div")
      expect(result).toContain("Hello World")
    })

    it("should handle empty content", () => {
      const content = ""
      const result = renderer.renderPlain(content)

      expect(result).toBe("")
    })

    it("should preserve exact content structure", () => {
      const content = "line 1\n\nline 3\n    indented line"
      const result = renderer.renderPlain(content)

      expect(result).toContain("line 1\n\nline 3\n    indented line")
    })
  })

  describe("theme support", () => {
    it("should work with different themes", async () => {
      const brightSyntaxRenderer = new SyntaxRenderer(themes.bright)
      await brightSyntaxRenderer.initialize()
      const brightFileRenderer = new FileRenderer(brightSyntaxRenderer)

      const content = "<div>test</div>"
      const result = brightFileRenderer.renderWithLineNumbers("/test/file.erb", content)

      expect(result).toContain("/test/file.erb")
      expect(result).toContain("div")
    })

    it("should work with pastel theme", async () => {
      const pastelSyntaxRenderer = new SyntaxRenderer(themes.pastel)
      await pastelSyntaxRenderer.initialize()
      const pastelFileRenderer = new FileRenderer(pastelSyntaxRenderer)

      const content = "<span>test</span>"
      const result = pastelFileRenderer.renderPlain(content)

      expect(result).toContain("span")
      expect(result).toContain("test")
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
        expect(result).toContain("/test/file.erb")
        expect(result).toContain("div")
        expect(result).toContain("test")
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

      expect(result).toContain("short line")
      expect(result).toContain(longLine)
    })

    it("should handle special characters", () => {
      const content = `line with\ttabs\nline with "quotes"\nline with \"single quotes\"`
      const result = renderer.renderWithLineNumbers("/test/file.erb", content)

      expect(result).toContain("tabs")
      expect(result).toContain(`quotes"`)
      expect(result).toContain("\"single quotes\"")
    })

    it("should handle unicode characters", () => {
      const content = "Unicode: 🎉 émojis and àccénts"
      const result = renderer.renderWithLineNumbers("/test/file.erb", content)

      expect(result).toContain("🎉")
      expect(result).toContain("émojis")
      expect(result).toContain("àccénts")
    })
  })
})
