import dedent from "dedent"
import { describe, test, expect, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { rewrite, rewriteString, tailwindClassSorter } from "../src/loader.js"

describe("rewrite", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  describe("basic usage", () => {
    test("rewrites Node with tailwindClassSorter", async () => {
      const template = '<div class="text-red-500 p-4 mt-2"></div>'
      const parseResult = Herb.parse(template, { track_whitespace: true })
      const { output, node } = await rewrite(parseResult.value, [tailwindClassSorter()])

      expect(output).toBe('<div class="mt-2 p-4 text-red-500"></div>')
      expect(node.type).toBe("AST_DOCUMENT_NODE")
    })

    test("handles empty rewriters array", async () => {
      const template = '<div class="text-red-500 p-4 mt-2"></div>'
      const parseResult = Herb.parse(template, { track_whitespace: true })
      const { output } = await rewrite(parseResult.value, [])

      expect(output).toBe(template)
    })

    test("handles multiple elements", async () => {
      const template = dedent`
        <div class="px-4 bg-blue-500">
          <span class="text-white font-bold"></span>
        </div>
      `
      const expected = dedent`
        <div class="bg-blue-500 px-4">
          <span class="font-bold text-white"></span>
        </div>
      `

      const parseResult = Herb.parse(template, { track_whitespace: true })
      const { output } = await rewrite(parseResult.value, [tailwindClassSorter()])

      expect(output).toBe(expected)
    })
  })

  describe("rewriteString", () => {
    test("rewrites string with tailwindClassSorter", async () => {
      const template = '<div class="text-red-500 p-4 mt-2"></div>'
      const output = await rewriteString(Herb, template, [tailwindClassSorter()])

      expect(output).toBe('<div class="mt-2 p-4 text-red-500"></div>')
    })

    test("handles empty rewriters array", async () => {
      const template = '<div class="text-red-500 p-4 mt-2"></div>'
      const output = await rewriteString(Herb, template, [])

      expect(output).toBe(template)
    })

    test("returns original template on parse failure", async () => {
      const template = '<div class="unclosed'
      const output = await rewriteString(Herb, template, [tailwindClassSorter()])

      expect(output).toBe(template)
    })
  })

  describe("options", () => {
    test("accepts baseDir option", async () => {
      const template = '<div class="text-red-500 p-4 mt-2"></div>'
      const parseResult = Herb.parse(template, { track_whitespace: true })
      const { output } = await rewrite(parseResult.value, [tailwindClassSorter()], {
        baseDir: "/custom/path"
      })

      expect(output).toBe('<div class="mt-2 p-4 text-red-500"></div>')
    })

    test("accepts filePath option", async () => {
      const template = '<div class="text-red-500 p-4 mt-2"></div>'
      const parseResult = Herb.parse(template, { track_whitespace: true })
      const { output } = await rewrite(parseResult.value, [tailwindClassSorter()], {
        filePath: "/custom/path/file.html.erb"
      })

      expect(output).toBe('<div class="mt-2 p-4 text-red-500"></div>')
    })

    test("uses process.cwd() as default baseDir", async () => {
      const template = '<div class="text-red-500 p-4 mt-2"></div>'
      const parseResult = Herb.parse(template, { track_whitespace: true })
      const { output } = await rewrite(parseResult.value, [tailwindClassSorter()])

      expect(output).toBe('<div class="mt-2 p-4 text-red-500"></div>')
    })
  })

  describe("complex templates", () => {
    test("handles ERB expressions", async () => {
      const template = '<div class="px-4 <%= extra_classes %> bg-blue-500"></div>'
      const { output } = await rewriteString(Herb, template, [tailwindClassSorter()])

      expect(output).toBe('<div class="bg-blue-500 px-4 <%= extra_classes %>"></div>')
    })

    test("handles ERB conditionals", async () => {
      const template = '<div class="px-4 <% if admin? %> text-red-500 font-bold <% end %> bg-blue-500"></div>'
      const { output } = await rewriteString(Herb, template, [tailwindClassSorter()])

      expect(output).toBe('<div class="bg-blue-500 px-4 <% if admin? %> font-bold text-red-500 <% end %>"></div>')
    })

    test("handles multiline templates", async () => {
      const template = dedent`
        <div class="px-4
          <% if valid? %>
            bg-green-500 font-bold text-green-800
          <% else %>
            font-bold bg-red-500 text-red-800
          <% end %>
          rounded">
        </div>
      `
      const expected = dedent`
        <div class="rounded px-4 <% if valid? %>
            bg-green-500 font-bold text-green-800
          <% else %>
            bg-red-500 font-bold text-red-800
          <% end %>">
        </div>
      `

      const { output } = await rewriteString(Herb, template, [tailwindClassSorter()])

      expect(output).toBe(expected)
    })
  })

  describe("error handling", () => {
    test("continues processing on rewriter error", async () => {
      const template = '<div class="text-red-500 p-4"></div>'

      const errorRewriter = tailwindClassSorter()
      errorRewriter.rewrite.bind(errorRewriter)

      errorRewriter.rewrite = () => {
        throw new Error("Test error")
      }

      const parseResult = Herb.parse(template, { track_whitespace: true })
      const { output } = await rewrite(parseResult.value, [errorRewriter])

      expect(output).toBe(template)
    })
  })

  describe("tailwindClassSorter factory", () => {
    test("creates rewriter with default options", () => {
      const rewriter = tailwindClassSorter()

      expect(rewriter.name).toBe("tailwind-class-sorter")
    })

    test("creates rewriter with custom baseDir", () => {
      const rewriter = tailwindClassSorter({ baseDir: "/custom/path" })

      expect(rewriter.name).toBe("tailwind-class-sorter")
    })

    test("rewriter has initialize method", async () => {
      const rewriter = tailwindClassSorter()

      await expect(
        rewriter.initialize({ baseDir: process.cwd() })
      ).resolves.not.toThrow()
    })
  })
})
