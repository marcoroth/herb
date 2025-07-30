import { describe, it, expect, beforeEach } from "vitest"
import { themes } from "../src/themes.js"

import { Herb } from "@herb-tools/node-wasm"
import { SyntaxRenderer } from "../src/syntax-renderer.js"

// Helper function to strip ANSI color codes for testing
function stripAnsiColors(text: string): string {
  return text.replace(/\x1b\[[0-9;]*m/g, '')
}

describe("SyntaxRenderer", () => {
  let renderer: SyntaxRenderer

  beforeEach(async () => {
    renderer = new SyntaxRenderer(themes.onedark, Herb)
    await renderer.initialize()
  })

  describe("initialization", () => {
    it("should initialize successfully", async () => {
      const mockHerb = {
        load: async () => { mockHerb.isLoaded = true },
        lex: () => ({ errors: [], value: [] }),
        isLoaded: false,
      }
      const freshRenderer = new SyntaxRenderer(themes.onedark, mockHerb as any)
      expect(freshRenderer.initialized).toBe(false)
      await freshRenderer.initialize()
      expect(freshRenderer.initialized).toBe(true)
    })

    it("should not reinitialize if already initialized", async () => {
      await renderer.initialize()
      expect(renderer.initialized).toBe(true)

      // Should not throw or cause issues
      await renderer.initialize()
      expect(renderer.initialized).toBe(true)
    })
  })

  describe("highlight", () => {
    beforeEach(async () => {
      await renderer.initialize()
    })

    it("should throw error if not initialized", async () => {
      const uninitializedHerb = {
        load: async () => {},
        lex: () => ({ errors: [], value: [] }),
        isLoaded: false,
      }
      const uninitializedRenderer = new SyntaxRenderer(themes.onedark, uninitializedHerb as any)
      // Don't initialize the renderer
      expect(() => uninitializedRenderer.highlight("<div>test</div>")).toThrow(
        "SyntaxRenderer must be initialized before use",
      )
    })

    it("should return original content for lex errors", async () => {
      const errorHerb = {
        load: async () => {},
        lex: () => ({ errors: ["error"], value: [] }),
        isLoaded: true,
      }

      const errorRenderer = new SyntaxRenderer(themes.onedark, errorHerb as any)
      await errorRenderer.initialize()

      const content = "<invalid>"
      const result = errorRenderer.highlight(content)
      expect(result).toBe(content)
    })

    it("should highlight simple HTML", () => {
      const content = "<div>hello</div>"
      const result = renderer.highlight(content)
      expect(result).toContain("div")
      expect(result).toContain("hello")
    })

    it("should handle empty content", () => {
      const result = renderer.highlight("")
      expect(result).toBe("")
    })

    it("should handle content with no tokens", async () => {
      const noTokenHerb = {
        load: async () => {},
        lex: () => ({ errors: [], value: [] }),
        isLoaded: true,
      }

      const noTokenRenderer = new SyntaxRenderer(
        themes.onedark,
        noTokenHerb as any,
      )
      await noTokenRenderer.initialize()

      const content = "plain text"
      const result = noTokenRenderer.highlight(content)

      expect(result).toBe(content)
    })
  })

  describe("theme support", () => {
    it("should work with different themes", async () => {
      const githubLightRenderer = new SyntaxRenderer(themes["github-light"], Herb)
      await githubLightRenderer.initialize()

      const content = "<div>test</div>"
      const result = githubLightRenderer.highlight(content)
      expect(result).toContain("div")
    })

    it("should work with simple theme", async () => {
      const simpleRenderer = new SyntaxRenderer(themes.simple, Herb)
      await simpleRenderer.initialize()

      const content = "<div>test</div>"
      const result = simpleRenderer.highlight(content)
      expect(result).toContain("div")
    })
  })

  describe("color disabled mode", () => {
    it("should return plain text when NO_COLOR is set", async () => {
      const originalNoColor = process.env.NO_COLOR
      process.env.NO_COLOR = "1"

      try {
        const noColorRenderer = new SyntaxRenderer(themes.onedark, Herb)
        await noColorRenderer.initialize()

        const content = "<div>test</div>"
        const result = noColorRenderer.highlight(content)
        // Should not contain ANSI escape codes
        expect(result).not.toMatch(/\x1b\\[[0-9;]*m/)
      } finally {
        if (originalNoColor === undefined) {
          delete process.env.NO_COLOR
        } else {
          process.env.NO_COLOR = originalNoColor
        }
      }
    })
  })

  describe("ERB content highlighting", () => {
    it("should highlight Ruby keywords in ERB blocks", async () => {
      const erbHerb = {
        load: async () => {},
        lex: () => ({
          errors: [],
          value: [
            { type: "TOKEN_ERB_START", range: { start: 0, end: 2 } },
            { type: "TOKEN_ERB_CONTENT", range: { start: 2, end: 12 } },
            { type: "TOKEN_ERB_END", range: { start: 12, end: 14 } },
          ],
        }),
        isLoaded: true,
      }

      const erbRenderer = new SyntaxRenderer(themes.onedark, erbHerb as any)
      await erbRenderer.initialize()

      const content = "<% if true %>"
      const result = erbRenderer.highlight(content)
      expect(result).toContain("if")
      expect(result).toContain("true")
    })
  })

  describe("comment state tracking", () => {
    it("should track HTML comment state", async () => {
      const commentHerb = {
        isLoaded: true,
        load: async () => {},
        lex: () => ({
          errors: [],
          value: [
            { type: "TOKEN_HTML_COMMENT_START", range: { start: 0, end: 4 } },
            { type: "TOKEN_IDENTIFIER", range: { start: 4, end: 11 } },
            { type: "TOKEN_HTML_COMMENT_END", range: { start: 11, end: 14 } },
          ],
        }),
      }

      const commentRenderer = new SyntaxRenderer(
        themes.onedark,
        commentHerb as any,
      )
      await commentRenderer.initialize()

      const content = "<!-- comment -->"
      const result = commentRenderer.highlight(content)
      expect(stripAnsiColors(result)).toContain("comment")
    })

    it("should preserve ERB highlighting in comments", async () => {
      const erbCommentHerb = {
        isLoaded: true,
        load: async () => {},
        lex: () => ({
          errors: [],
          value: [
            { type: "TOKEN_HTML_COMMENT_START", range: { start: 0, end: 4 } },
            { type: "TOKEN_ERB_START", range: { start: 5, end: 7 } },
            { type: "TOKEN_ERB_CONTENT", range: { start: 7, end: 12 } },
            { type: "TOKEN_ERB_END", range: { start: 12, end: 14 } },
            { type: "TOKEN_HTML_COMMENT_END", range: { start: 15, end: 18 } },
          ],
        }),
      }

      const erbCommentRenderer = new SyntaxRenderer(
        themes.onedark,
        erbCommentHerb as any,
      )
      await erbCommentRenderer.initialize()

      const content = "<!-- <% code %> -->"
      const result = erbCommentRenderer.highlight(content)
      expect(result).toMatchInlineSnapshot(
        `"[38;2;92;99;112m<!--[0m [38;2;190;80;70m<%[0m code[38;2;190;80;70m %[0m>[38;2;92;99;112m --[0m>"`,
      )
    })
  })
})
