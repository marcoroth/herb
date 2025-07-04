import { join } from "path"
import { writeFileSync, unlinkSync } from "fs"
import {
  describe,
  test,
  expect,
  beforeAll,
  beforeEach,
  afterEach,
  afterAll,
} from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { Highlighter } from "../src/highlighter.js"

describe("Highlighter", () => {
  let highlighter: Highlighter

  beforeAll(async () => {
    await Herb.load()
  })

  beforeEach(async () => {
    highlighter = new Highlighter("default")
    await highlighter.initialize()
  })

  test("should highlight basic HTML tags", () => {
    const input = "<h1>Hello</h1>"
    const result = highlighter.highlight("test.erb", input, {
      showLineNumbers: false,
    })

    // Should contain ANSI color codes for tags
    expect(result).toContain("\x1b[38;2;224;108;117m<\x1b[0m") // red "<"
    expect(result).toContain("\x1b[38;2;224;108;117mh1\x1b[0m") // red "h1"
  })

  test("should highlight ERB blocks with Ruby syntax", () => {
    const input = "<% if true %>"
    const result = highlighter.highlight("test.erb", input, {
      showLineNumbers: false,
    })

    // Should contain purple keywords without ANSI corruption
    expect(result).toContain("\x1b[38;2;198;120;221mif\x1b[0m") // purple "if"
    expect(result).toContain("\x1b[38;2;198;120;221mtrue\x1b[0m") // purple "true"

    // Should NOT contain corrupted ANSI codes
    expect(result).not.toContain("[38;2;209;154;102m38") // corrupted pattern
  })

  test("should highlight complex ERB with if/elsif/else/end", () => {
    const input = `<% if condition %>
    <div>One</div>
<% elsif other %>
    <div>Two</div>
<% else %>
    <div>Three</div>
<% end %>`

    const result = highlighter.highlight("test.erb", input, {
      showLineNumbers: false,
    })

    // All Ruby keywords should be properly colored
    expect(result).toContain("\x1b[38;2;198;120;221mif\x1b[0m")
    expect(result).toContain("\x1b[38;2;198;120;221melsif\x1b[0m")
    expect(result).toContain("\x1b[38;2;198;120;221melse\x1b[0m")
    expect(result).toContain("\x1b[38;2;198;120;221mend\x1b[0m")

    // Should not contain any corrupted ANSI sequences
    expect(result).not.toMatch(/\[38;2;\d+;\d+;\d+m\d+/)
  })

  test("should highlight HTML attributes", () => {
    const input = `<div class="example" id="test">`
    const result = highlighter.highlight("test.erb", input, {
      showLineNumbers: false,
    })

    // Should contain colored attributes
    expect(result).toContain("\x1b[38;2;209;154;102mclass\x1b[0m") // orange attribute name
    expect(result).toContain("\x1b[38;2;152;195;121mexample\x1b[0m") // green string content
    expect(result).toContain("\x1b[38;2;152;195;121mtest\x1b[0m") // green string content
  })

  test("should handle ERB output tags", () => {
    const input = "<%= user.name %>"
    const result = highlighter.highlight("test.erb", input, {
      showLineNumbers: false,
    })

    // Should contain ERB tag colors
    expect(result).toContain("\x1b[38;2;190;80;70m<%=\x1b[0m") // ERB start
    expect(result).toContain("\x1b[38;2;190;80;70m%>\x1b[0m") // ERB end
  })

  test("should not add colors when NO_COLOR is set", async () => {
    process.env.NO_COLOR = "1"
    const disabledHighlighter = new Highlighter("default")
    await disabledHighlighter.initialize()

    const input = "<% if true %>"
    const result = disabledHighlighter.highlight("test.erb", input, {
      showLineNumbers: false,
    })

    // Should return plain text without ANSI codes
    expect(result).toBe(input)
    expect(result).not.toContain("\x1b[")

    delete process.env.NO_COLOR
  })

  test("should handle mixed HTML and ERB content", () => {
    const input = `<h1 id="<%= dom_id(article) %>">Title</h1>`
    const result = highlighter.highlight("test.erb", input, {
      showLineNumbers: false,
    })

    // Should highlight both HTML and ERB parts correctly
    expect(result).toContain("\x1b[38;2;224;108;117mh1\x1b[0m") // HTML tag
    expect(result).toContain("\x1b[38;2;190;80;70m<%=\x1b[0m") // ERB start
    expect(result).toContain("\x1b[38;2;171;178;191mTitle\x1b[0m") // Text content
  })

  test("should handle all Ruby keywords correctly", () => {
    const keywords = [
      "if",
      "unless",
      "else",
      "elsif",
      "end",
      "def",
      "class",
      "module",
      "return",
      "yield",
      "break",
      "next",
      "case",
      "when",
      "then",
      "while",
      "until",
      "for",
      "in",
      "do",
      "begin",
      "rescue",
      "ensure",
      "retry",
      "raise",
      "super",
      "self",
      "nil",
      "true",
      "false",
      "and",
      "or",
      "not",
    ]

    for (const keyword of keywords) {
      const input = `<% ${keyword} %>`
      const result = highlighter.highlight("test.erb", input, {
        showLineNumbers: false,
      })

      // Each keyword should be properly colored without corruption
      expect(result).toContain(`\x1b[38;2;198;120;221m${keyword}\x1b[0m`)
      expect(result).not.toContain("[38;2;209;154;102m38") // No corruption
    }
  })

  describe("highlightFile method", () => {
    const testFile = join(__dirname, "test-highlighter-file.html.erb")

    beforeEach(() => {
      writeFileSync(
        testFile,
        `<div class="container">
  <% if user %>
    <span>Hello <%= user.name %>!</span>
  <% end %>
</div>`,
      )
    })

    afterEach(() => {
      try {
        unlinkSync(testFile)
      } catch (e) {
        // Ignore cleanup errors
      }
    })

    test("should highlight a file", () => {
      const result = highlighter.highlightFileFromPath(testFile)

      // Should contain ANSI color codes
      expect(result).toContain("\x1b[38;2;224;108;117m<\x1b[0m") // HTML tags
      expect(result).toContain("\x1b[38;2;198;120;221mif\x1b[0m") // Ruby keywords
      expect(result).toContain("\x1b[38;2;190;80;70m<%\x1b[0m") // ERB tags
    })

    test("should throw error for non-existent file", () => {
      expect(() =>
        highlighter.highlightFileFromPath("non-existent-file.erb"),
      ).toThrow("Failed to read file")
    })
  })
})

describe("Standalone utility functions", () => {
  const testFile = join(__dirname, "test-utility-file.html.erb")

  beforeAll(async () => {
    await Herb.load()

    writeFileSync(
      testFile,
      `<h1>
  <% unless condition %>
    <p>Default content</p>
  <% end %>
</h1>`,
    )
  })

  afterAll(() => {
    try {
      unlinkSync(testFile)
    } catch (e) {
      // Ignore cleanup errors
    }
  })

  test("highlightContent should work with default theme", async () => {
    const content = `<% def hello %><span>Hi</span><% end %>`
    const result = await highlightContent(content)

    expect(result).toContain("\x1b[38;2;198;120;221mdef\x1b[0m") // Ruby keyword
    expect(result).toContain("\x1b[38;2;224;108;117mspan\x1b[0m") // HTML tag
  })

  test("highlightContent should work with bright theme", async () => {
    const content = "<% true %>"
    const result = await highlightContent(content, "bright")

    expect(result).toContain("\x1b[91mtrue\x1b[0m") // Bright red for keywords in bright theme
  })

  test("highlightFile should work with default theme", async () => {
    const result = await highlightFile(testFile)

    expect(result).toContain("\x1b[38;2;224;108;117mh1\x1b[0m") // HTML tag
    expect(result).toContain("\x1b[38;2;198;120;221munless\x1b[0m") // Ruby keyword
  })

  test("highlightFile should work with pastel theme", async () => {
    const result = await highlightFile(testFile, "pastel")

    expect(result).toContain("\x1b[36mh1\x1b[0m") // Cyan for HTML tags in pastel theme
    expect(result).toContain("\x1b[31munless\x1b[0m") // Red for keywords in pastel theme
  })

  test("highlightFile should throw error for non-existent file", async () => {
    await expect(highlightFile("non-existent-file.erb")).rejects.toThrow(
      "Failed to read file",
    )
  })

  test("should support focusLine with contextLines", async () => {
    const content = `<h1>Title</h1>
<div class="container">
  <% if user %>
    <span>Welcome</span>
  <% end %>
</div>`

    const highlighter = new Highlighter("default")
    await highlighter.initialize()

    const result = highlighter.highlight("test.erb", content, {
      focusLine: 3,
      contextLines: 1,
    })

    // Should contain the focused line with arrow and bold
    expect(result).toContain("  → ")
    expect(result).toContain("\x1b[1m  3") // Bold line number for focus line

    // Should contain dimmed context lines
    expect(result).toContain("\x1b[2;") // Dim ANSI code added to existing colors

    // Should not show all lines (only focus + context)
    const lines = result.split("\n")
    const lineNumberCount = lines.filter((line) => line.includes("│")).length
    expect(lineNumberCount).toBe(3) // Lines 2, 3, 4 only
  })
})
