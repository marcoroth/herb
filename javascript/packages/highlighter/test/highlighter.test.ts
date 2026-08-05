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
import dedent from "dedent"

import { Herb } from "@herb-tools/node-wasm"
import { ANSI_REGEX } from "../src/color.js"
import { Highlighter, highlightContent, highlightFile } from "../src/highlighter.js"

describe("Highlighter", () => {
  let highlighter: Highlighter

  beforeAll(async () => {
    await Herb.load()
  })

  beforeEach(async () => {
    highlighter = new Highlighter("onedark")
    await highlighter.initialize()
  })

  test("should highlight basic HTML tags", () => {
    const input = "<h1>Hello</h1>"
    const result = highlighter.highlight("test.erb", input, {
      showLineNumbers: false,
    })

    expect(result).toMatchSnapshot()
  })

  test("should highlight ERB blocks with Ruby syntax", () => {
    const input = "<% if true %>"
    const result = highlighter.highlight("test.erb", input, {
      showLineNumbers: false,
    })

    expect(result).toMatchSnapshot()
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

    expect(result).toMatchSnapshot()
  })

  test("should highlight HTML attributes", () => {
    const input = `<div class="example" id="test">`
    const result = highlighter.highlight("test.erb", input, {
      showLineNumbers: false,
    })

    expect(result).toMatchSnapshot()
  })

  test("should handle ERB output tags", () => {
    const input = "<%= user.name %>"
    const result = highlighter.highlight("test.erb", input, {
      showLineNumbers: false,
    })

    expect(result).toMatchSnapshot()
  })

  test("should not add colors when NO_COLOR is set", async () => {
    process.env.NO_COLOR = "1"
    const disabledHighlighter = new Highlighter("onedark")
    await disabledHighlighter.initialize()

    const input = "<% if true %>"
    const result = disabledHighlighter.highlight("test.erb", input, {
      showLineNumbers: false,
    })

    expect(result).toBe(input)
    expect(result).toMatchSnapshot()

    delete process.env.NO_COLOR
  })

  test("should handle mixed HTML and ERB content", () => {
    const input = `<h1 id="<%= dom_id(article) %>">Title</h1>`
    const result = highlighter.highlight("test.erb", input, {
      showLineNumbers: false,
    })

    expect(result).toMatchSnapshot()
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

    const highlighted = keywords.map((keyword) =>
      highlighter.highlight("test.erb", `<% ${keyword} %>`, {
        showLineNumbers: false,
      }),
    )

    expect(highlighted).toMatchSnapshot()
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
      } catch {
        // Ignore cleanup errors
      }
    })

    test("should highlight a file", () => {
      const result = highlighter.highlightFileFromPath(testFile)

      expect(result.replaceAll(__dirname, "<test-dir>")).toMatchSnapshot()
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
    } catch {
      // Ignore cleanup errors
    }
  })

  test("highlightContent should work with default theme", async () => {
    const content = `<% def hello %><span>Hi</span><% end %>`
    const result = await highlightContent(content)

    expect(result).toMatchSnapshot()
  })

  test("highlightContent should work with github-light theme", async () => {
    const content = "<% true %>"
    const result = await highlightContent(content, "github-light")

    expect(result).toMatchSnapshot()
  })

  test("highlightFile should work with default theme", async () => {
    const result = await highlightFile(testFile)

    expect(result.replaceAll(testFile, "<test-file>")).toMatchSnapshot()
  })

  test("highlightFile should work with simple theme", async () => {
    const result = await highlightFile(testFile, "simple")

    expect(result.replaceAll(testFile, "<test-file>")).toMatchSnapshot()
  })

  test("highlightFile should throw error for non-existent file", async () => {
    await expect(highlightFile("non-existent-file.erb")).rejects.toThrow(
      "Failed to read file",
    )
  })

  test("should support focusLine with contextLines", async () => {
    const content = dedent`
      <h1>Title</h1>
      <div class="container">
        <% if user %>
          <span>Welcome</span>
        <% end %>
      </div>
    `

    const highlighter = new Highlighter("onedark")
    await highlighter.initialize()

    const result = highlighter.highlight("test.erb", content, {
      focusLine: 3,
      contextLines: 1,
    })

    expect(result).toMatchSnapshot()
  })

  test("should support truncateLines option", async () => {
    const longLineContent = dedent`
      <div class="this-is-a-very-long-class-name-that-should-be-truncated-when-the-line-exceeds-maximum-width">Content</div>
      <span>Short line</span>
    `

    const highlighter = new Highlighter("onedark")
    await highlighter.initialize()

    const result = highlighter.highlight("test.erb", longLineContent, {
      wrapLines: false,
      truncateLines: true,
      maxWidth: 60,
    })

    expect(result.replace(ANSI_REGEX, "")).toMatchSnapshot()
  })
})
