import { describe, it, expect, beforeEach } from "vitest"
import dedent from "dedent"

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
      const content = dedent`
        line 1
        line 2
        line 3
      `
      const result = renderer.renderWithLineNumbers("/test/file.erb", content)

      expect(stripAnsiColors(result)).toMatchSnapshot()
    })

    it("should handle single line content", () => {
      const content = "single line"
      const result = renderer.renderWithLineNumbers("/test/file.erb", content)

      expect(stripAnsiColors(result)).toMatchSnapshot()
    })

    it("should handle empty content", () => {
      const content = ""
      const result = renderer.renderWithLineNumbers("/test/file.erb", content)

      expect(stripAnsiColors(result)).toMatchSnapshot()
    })

    it("should handle content with empty lines", () => {
      const content = dedent`
        line 1

        line 3
      `
      const result = renderer.renderWithLineNumbers("/test/file.erb", content)

      expect(stripAnsiColors(result)).toMatchSnapshot()
    })

    it("should apply syntax highlighting", () => {
      const content = "<div>Hello</div>"
      const result = renderer.renderWithLineNumbers("/test/file.erb", content)

      expect(result).toMatchSnapshot()
    })
  })

  describe("renderWithFocusLine", () => {
    it("should highlight focus line and dim others", () => {
      const content = dedent`
        line 1
        line 2
        line 3
        line 4
        line 5
      `
      const result = renderer.renderWithFocusLine(
        "/test/file.erb",
        content,
        3,
        1,
        true,
      )

      expect(stripAnsiColors(result)).toMatchSnapshot()
    })

    it("should handle focus line at beginning of file", () => {
      const content = dedent`
        line 1
        line 2
        line 3
      `
      const result = renderer.renderWithFocusLine(
        "/test/file.erb",
        content,
        1,
        1,
        true,
      )

      expect(stripAnsiColors(result)).toMatchSnapshot()
    })

    it("should handle focus line at end of file", () => {
      const content = dedent`
        line 1
        line 2
        line 3
      `
      const result = renderer.renderWithFocusLine(
        "/test/file.erb",
        content,
        3,
        1,
        true,
      )

      expect(stripAnsiColors(result)).toMatchSnapshot()
    })

    it("should handle large context that exceeds file bounds", () => {
      const content = dedent`
        line 1
        line 2
      `
      const result = renderer.renderWithFocusLine(
        "/test/file.erb",
        content,
        1,
        10,
        true,
      )

      expect(stripAnsiColors(result)).toMatchSnapshot()
    })

    it("should work without line numbers", () => {
      const content = dedent`
        line 1
        line 2
        line 3
      `
      const result = renderer.renderWithFocusLine(
        "/test/file.erb",
        content,
        2,
        1,
        false,
      )

      expect(stripAnsiColors(result)).toMatchSnapshot()
    })

    it("should apply syntax highlighting", () => {
      const content = dedent`
        <div>line 1</div>
        <span>line 2</span>
        <p>line 3</p>
      `
      const result = renderer.renderWithFocusLine(
        "/test/file.erb",
        content,
        2,
        1,
        true,
      )

      expect(result).toMatchSnapshot()
    })
  })

  describe("renderPlain", () => {
    it("should render content without line numbers or file headers", () => {
      const content = dedent`
        line 1
        line 2
        line 3
      `
      const result = renderer.renderPlain(content)

      expect(stripAnsiColors(result)).toMatchSnapshot()
    })

    it("should apply syntax highlighting", () => {
      const content = "<div>Hello World</div>"
      const result = renderer.renderPlain(content)

      expect(result).toMatchSnapshot()
    })

    it("should handle empty content", () => {
      const content = ""
      const result = renderer.renderPlain(content)

      expect(result).toBe("")
    })

    it("should preserve exact content structure", () => {
      const content = dedent`
        line 1

        line 3
            indented line
      `
      const result = renderer.renderPlain(content)

      expect(stripAnsiColors(result)).toContain(content)
      expect(stripAnsiColors(result)).toMatchSnapshot()
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

      expect(result).toMatchSnapshot()
    })

    it("should work with simple theme", async () => {
      const simpleSyntaxRenderer = new SyntaxRenderer(themes.simple)
      await simpleSyntaxRenderer.initialize()
      const simpleFileRenderer = new FileRenderer(simpleSyntaxRenderer)

      const content = "<span>test</span>"
      const result = simpleFileRenderer.renderPlain(content)

      expect(result).toMatchSnapshot()
    })
  })

  describe("line truncation", () => {
    it("should truncate long lines with ellipsis", () => {
      const longContent = "This is a very long line that should be truncated when it exceeds the maximum width limit"
      const result = renderer.renderWithLineNumbers("/test/file.erb", longContent, false, 50, true)

      expect(stripAnsiColors(result)).toMatchSnapshot()
    })

    it("should truncate lines in renderPlain method", () => {
      const longContent = "This is another very long line that should be truncated when using renderPlain method"
      const result = renderer.renderPlain(longContent, 50, false, true)

      expect(stripAnsiColors(result)).toMatchSnapshot()
    })

    it("should not truncate lines shorter than maxWidth", () => {
      const shortContent = "Short line"
      const result = renderer.renderWithLineNumbers("/test/file.erb", shortContent, false, 50, true)

      const strippedResult = stripAnsiColors(result)

      expect(strippedResult).not.toContain("…")
      expect(strippedResult).toMatchSnapshot()
    })
  })

  describe("NO_COLOR environment", () => {
    it("should respect NO_COLOR environment variable", () => {
      const originalNoColor = process.env.NO_COLOR
      process.env.NO_COLOR = "1"

      try {
        const content = "<div>test</div>"
        const result = renderer.renderWithLineNumbers("/test/file.erb", content)

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

  describe("edge cases", () => {
    it("should handle very long lines", () => {
      const longLine = "a".repeat(1000)
      const content = dedent`
        short line
        ${longLine}
        short line
      `
      const result = renderer.renderWithLineNumbers("/test/file.erb", content)

      expect(stripAnsiColors(result)).toContain(longLine)
      expect(stripAnsiColors(result)).toMatchSnapshot()
    })

    it("should handle special characters", () => {
      const content = dedent`
        line with\ttabs
        line with "quotes"
        line with "single quotes"
      `
      const result = renderer.renderWithLineNumbers("/test/file.erb", content)

      expect(stripAnsiColors(result)).toMatchSnapshot()
    })

    it("should handle unicode characters", () => {
      const content = "Unicode: 🎉 émojis and àccénts"
      const result = renderer.renderWithLineNumbers("/test/file.erb", content)

      expect(stripAnsiColors(result)).toMatchSnapshot()
    })
  })
})
