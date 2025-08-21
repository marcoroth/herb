import dedent from "dedent"

import { Herb } from "../src"
import { describe, test, expect, beforeAll } from "vitest"

describe("@herb-tools/node-wasm - ERB Comments", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("handles simple ERB comment", () => {
    const result = Herb.parse("<%# Simple comment %>")
    expect(result).toBeDefined()
    expect(result.errors).toHaveLength(0)
    expect(result.value).toBeDefined()
  })

  test("handles moderately long ERB comments (500 chars)", () => {
    const content = `<%# ${'a'.repeat(500)} %>`
    const result = Herb.parse(content)

    expect(result).toBeDefined()
    expect(result.errors).toHaveLength(0)
    expect(result.value).toBeDefined()
    expect(result.value.children).toHaveLength(1)
    expect(result.value.children[0].type).toBe("AST_ERB_CONTENT_NODE")
    expect(result.value.children[0].parsed).toBe(false)
    expect(result.value.children[0].valid).toBe(true)
  })

  test("handles long ERB comments (1000 chars)", () => {
    const content = `<%# ${'a'.repeat(1000)} %>`
    const result = Herb.parse(content)

    expect(result).toBeDefined()
    expect(result.errors).toHaveLength(0)
    expect(result.value).toBeDefined()
  })

  test("handles very long ERB comments (5000 chars)", () => {
    const content = `<%# ${'a'.repeat(5000)} %>`
    const result = Herb.parse(content)

    expect(result).toBeDefined()
    expect(result.errors).toHaveLength(0)
    expect(result.value).toBeDefined()
  })

  test("handles extremely long ERB comments (10000 chars)", () => {
    const content = `<%# ${'a'.repeat(10000)} %>`
    const result = Herb.parse(content)

    expect(result).toBeDefined()
    expect(result.errors).toHaveLength(0)
    expect(result.value).toBeDefined()
  })

  test("handles long multiline ERB comments", () => {
    const lines = Array.from({ length: 100 }, (_, i) => `Line ${i}: ${'x'.repeat(50)}`)
    const content = `<%#\n${lines.join('\n')}\n%>`
    const result = Herb.parse(content)

    expect(result).toBeDefined()
    expect(result.errors).toHaveLength(0)
    expect(result.value).toBeDefined()
  })

  test("handles nested HTML with long ERB comments", () => {
    const content = dedent`
      <div>
        <%# ${'This is a very long comment '.repeat(100)} %>
        <p>Content</p>
      </div>
    `

    const result = Herb.parse(content)
    expect(result).toBeDefined()
    expect(result.errors).toHaveLength(0)
    expect(result.value).toBeDefined()
  })

  test("handles multiple long ERB comments", () => {
    const content = dedent`
      <%# First long comment: ${'a'.repeat(1000)} %>
      <div>
        <%# Second long comment: ${'b'.repeat(1000)} %>
        <p>Content</p>
        <%# Third long comment: ${'c'.repeat(1000)} %>
      </div>
    `

    const result = Herb.parse(content)
    expect(result).toBeDefined()
    expect(result.errors).toHaveLength(0)
    expect(result.value).toBeDefined()
  })

  test("handles ERB comments with special characters", () => {
    const content = `<%# ${'<>&"'.repeat(500)} %>`
    const result = Herb.parse(content)

    expect(result).toBeDefined()
    expect(result.errors).toHaveLength(0)
    expect(result.value).toBeDefined()
  })

  test("handles ERB comments with Unicode characters", () => {
    const content = `<%# ${'🚀✨💎'.repeat(300)} %>`
    const result = Herb.parse(content)

    expect(result).toBeDefined()
    expect(result.errors).toHaveLength(0)
    expect(result.value).toBeDefined()
  })

  test("handles Unicode characters with ERB tags (regression test)", () => {
    const content = dedent`
      <p>
        <%= "Text with — dash" %> and 'quotes'
      </p>
      <%# ERB comment %>
    `

    const result = Herb.parse(content)
    expect(result).toBeDefined()
    expect(result.errors).toHaveLength(0)
    expect(result.value).toBeDefined()

    const erbComment = result.value.children.find((child: any) =>
      child.type === "AST_ERB_CONTENT_NODE" &&
      child.tag_opening?.value === "<%#"
    )

    expect(erbComment).toBeDefined()
    expect(erbComment.content.value).toBe(" ERB comment ")
    expect(erbComment.parsed).toBe(false)
    expect(erbComment.valid).toBe(true)
  })

  test("parses AST correctly for long ERB comments", () => {
    const content = `<%# ${'test'.repeat(250)} %>`
    const result = Herb.parse(content)

    expect(result).toBeDefined()
    expect(result.errors).toHaveLength(0)
    expect(result.value).toBeDefined()
    expect(result.value.children).toHaveLength(1)

    const erbNode = result.value.children[0]
    expect(erbNode.type).toBe("AST_ERB_CONTENT_NODE")
    expect(erbNode.tag_opening.value).toBe("<%#")
    expect(erbNode.tag_closing.value).toBe("%>")
    expect(erbNode.content.value).toContain("test".repeat(250))
  })

  test("handles very large comment length (50000 chars)", () => {
    const content = `<%# ${'a'.repeat(50000)} %>`
    const result = Herb.parse(content)

    expect(result).toBeDefined()
    expect(result.errors).toHaveLength(0)
    expect(result.value).toBeDefined()
  })

  test("handles deeply nested ERB comments without stack overflow", () => {
    const content = `<%# Start ${'nested '.repeat(1000)}End %>`
    const result = Herb.parse(content)

    expect(result).toBeDefined()
    expect(result.errors).toHaveLength(0)
    expect(result.value).toBeDefined()
  })

  test("handles multiline ERB comments similar to WASM failing case", () => {
    const longComment = Array.from({ length: 1000 }, (_, i) => `Line ${i} with some content`).join('\n')
    const content = `<%#\n${longComment}\n%>`
    const result = Herb.parse(content)

    expect(result).toBeDefined()
    expect(result.errors).toHaveLength(0)
    expect(result.value).toBeDefined()

    const erbNode = result.value.children[0]
    expect(erbNode.type).toBe("AST_ERB_CONTENT_NODE")
    expect(erbNode.content.value).toContain("Line 999 with some content")
  })

  test("handles ERB comments that were previously causing formatter issues", () => {
    const testCases = [
      '<%# herb lsp herb lsp herb lsp herb lsp herb lsp herb lsp herb lsp herb lsp herb lsp herb lsp herb lsp herb lsp herb lsp herb lsp %>',
      '<%# This comment is exactly 80 characters long and should not crash %>',
      '<%# This is a very long ERB comment that exceeds 100 characters and should be handled gracefully %>',

      dedent`
        <%#
        hello
        this is a
        multi-line ERB
        comment
        %>
      `
    ]

    testCases.forEach((content, index) => {
      const result = Herb.parse(content)
      expect(result, `Test case ${index + 1} failed`).toBeDefined()
      expect(result.errors, `Test case ${index + 1} had errors`).toHaveLength(0)
      expect(result.value, `Test case ${index + 1} had no AST`).toBeDefined()

      const erbNode = result.value.children[0]
      expect(erbNode.type).toBe("AST_ERB_CONTENT_NODE")
      expect(erbNode.parsed).toBe(false)
      expect(erbNode.valid).toBe(true)
    })
  })

  test("performance test - handles multiple large ERB comments efficiently", () => {
    const comments = Array.from({ length: 10 }, (_, i) =>
      `<%# Comment ${i}: ${'x'.repeat(1000)} %>`
    )
    const content = comments.join('\n<div>Content</div>\n')

    const startTime = Date.now()
    const result = Herb.parse(content)
    const endTime = Date.now()

    expect(result).toBeDefined()
    expect(result.errors).toHaveLength(0)
    expect(result.value).toBeDefined()

    expect(endTime - startTime).toBeLessThan(1000)
  })

  test("stress test - handles extreme comment length without crashing", () => {
    const content = `<%# ${'a'.repeat(100000)} %>`

    const result = Herb.parse(content)
    expect(result).toBeDefined()
    expect(result.errors).toHaveLength(0)
    expect(result.value).toBeDefined()
  }, 10000)
})
