import { describe, test, expect, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { HTMLCommentNode, HTMLElementNode } from "@herb-tools/core"

import { isNode } from "@herb-tools/core"
import { extractHTMLCommentContent, formatHTMLCommentInner, formatERBCommentLines } from "../src/comment-helpers.js"

function parseComment(source: string) {
  const result = Herb.parse(source)
  const children = result.value.children

  for (const child of children) {
    if (isNode(child, HTMLCommentNode)) {
      return child
    }

    if (isNode(child, HTMLElementNode)) {
      for (const bodyChild of child.body) {
        if (isNode(bodyChild, HTMLCommentNode)) {
          return bodyChild
        }
      }
    }
  }

  return null
}

describe("comment-helpers", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  describe("extractHTMLCommentContent", () => {
    test("extracts text content from comment children", () => {
      const comment = parseComment("<!-- hello world -->")

      expect(comment).not.toBeNull()
      const content = extractHTMLCommentContent(comment!.children)
      expect(content).toBe(" hello world ")
    })

    test("extracts content with ERB nodes", () => {
      const comment = parseComment("<!-- hello <%= name %> -->")

      expect(comment).not.toBeNull()
      const content = extractHTMLCommentContent(comment!.children)
      expect(content).toBe(" hello <%= name %> ")
    })

    test("returns empty string for empty children", () => {
      const content = extractHTMLCommentContent([])
      expect(content).toBe("")
    })
  })

  describe("formatHTMLCommentInner", () => {
    test("wraps single-line content with spaces", () => {
      const result = formatHTMLCommentInner(" hello world ", 2)
      expect(result).toBe(" hello world ")
    })

    test("trims and wraps single-line content", () => {
      const result = formatHTMLCommentInner("hello", 2)
      expect(result).toBe(" hello ")
    })

    test("passes through IE conditional comments", () => {
      const raw = "[if lte IE 9]>some content<![endif]"
      const result = formatHTMLCommentInner(raw, 2)
      expect(result).toBe(raw)
    })

    test("reformats multiline content with first line having content", () => {
      const raw = "line1\nline2\nline3"
      const result = formatHTMLCommentInner(raw, 2)

      expect(result).toBe("\n  line1\n  line2\n  line3\n")
    })

    test("reformats multiline content with relative indent preservation", () => {
      const raw = "\n    line1\n      indented\n    line3\n"
      const result = formatHTMLCommentInner(raw, 2)

      expect(result).toBe("\n  line1\n    indented\n  line3\n")
    })

    test("handles empty inner string", () => {
      const result = formatHTMLCommentInner("", 2)
      expect(result).toBe("  ")
    })
  })

  describe("formatERBCommentLines", () => {
    test("formats single-line comment without leading space", () => {
      const result = formatERBCommentLines("<%#", "comment text", "%>")

      expect(result.type).toBe("single-line")
      if (result.type === "single-line") {
        expect(result.text).toBe("<%# comment text %>")
      }
    })

    test("formats single-line comment with leading space", () => {
      const result = formatERBCommentLines("<%#", " comment text", "%>")

      expect(result.type).toBe("single-line")
      if (result.type === "single-line") {
        expect(result.text).toBe("<%# comment text %>")
      }
    })

    test("trims multiline content that reduces to single line", () => {
      const result = formatERBCommentLines("<%#", "\n  comment text  \n", "%>")

      expect(result.type).toBe("single-line")
      if (result.type === "single-line") {
        expect(result.text).toBe("<%# comment text %>")
      }
    })

    test("returns multi-line result for true multiline content", () => {
      const result = formatERBCommentLines("<%#", "\n  line1\n  line2\n", "%>")

      expect(result.type).toBe("multi-line")
      if (result.type === "multi-line") {
        expect(result.header).toBe("<%#")
        expect(result.footer).toBe("%>")
        expect(result.contentLines).toEqual(["line1", "line2"])
      }
    })

    test("handles empty content", () => {
      const result = formatERBCommentLines("<%#", "", "%>")

      expect(result.type).toBe("single-line")
      if (result.type === "single-line") {
        expect(result.text).toBe("<%#  %>")
      }
    })

    test("handles content with leading whitespace on multiple lines", () => {
      const result = formatERBCommentLines("<%#", "\n    first line\n    second line\n", "%>")

      expect(result.type).toBe("multi-line")
      if (result.type === "multi-line") {
        expect(result.header).toBe("<%#")
        expect(result.footer).toBe("%>")
        expect(result.contentLines).toEqual(["first line", "second line"])
      }
    })
  })
})
