import dedent from "dedent"
import { describe, test, expect, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { rewrite, rewriteString, tailwindClassSorter } from "../src/loader.js"

describe("rewrite", () => {
  let sorter: Awaited<ReturnType<typeof tailwindClassSorter>>

  beforeAll(async () => {
    await Herb.load()
    sorter = await tailwindClassSorter()
  })

  describe("basic usage", () => {
    test("rewrites Node with tailwindClassSorter", () => {
      const template = '<div class="text-red-500 p-4 mt-2"></div>'
      const parseResult = Herb.parse(template, { track_whitespace: true })
      const { output, node } = rewrite(parseResult.value, [sorter])

      expect(output).toBe('<div class="mt-2 p-4 text-red-500"></div>')
      expect(node.type).toBe("AST_DOCUMENT_NODE")
    })

    test("handles empty rewriters array", () => {
      const template = '<div class="text-red-500 p-4 mt-2"></div>'
      const parseResult = Herb.parse(template, { track_whitespace: true })
      const { output } = rewrite(parseResult.value, [])

      expect(output).toBe(template)
    })

    test("handles multiple elements", () => {
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
      const { output } = rewrite(parseResult.value, [sorter])

      expect(output).toBe(expected)
    })
  })

  describe("rewriteString", () => {
    test("rewrites string with tailwindClassSorter", () => {
      const template = '<div class="text-red-500 p-4 mt-2"></div>'
      const output = rewriteString(Herb, template, [sorter])

      expect(output).toBe('<div class="mt-2 p-4 text-red-500"></div>')
    })

    test("handles empty rewriters array", () => {
      const template = '<div class="text-red-500 p-4 mt-2"></div>'
      const output = rewriteString(Herb, template, [])

      expect(output).toBe(template)
    })

    test("returns original template on parse failure", () => {
      const template = '<div class="unclosed'
      const output = rewriteString(Herb, template, [sorter])

      expect(output).toBe(template)
    })
  })

  describe("options", () => {
    test("accepts baseDir option", () => {
      const template = '<div class="text-red-500 p-4 mt-2"></div>'
      const parseResult = Herb.parse(template, { track_whitespace: true })
      const { output } = rewrite(parseResult.value, [sorter], {
        baseDir: "/custom/path"
      })

      expect(output).toBe('<div class="mt-2 p-4 text-red-500"></div>')
    })

    test("accepts filePath option", () => {
      const template = '<div class="text-red-500 p-4 mt-2"></div>'
      const parseResult = Herb.parse(template, { track_whitespace: true })
      const { output } = rewrite(parseResult.value, [sorter], {
        filePath: "/custom/path/file.html.erb"
      })

      expect(output).toBe('<div class="mt-2 p-4 text-red-500"></div>')
    })

    test("uses process.cwd() as default baseDir", () => {
      const template = '<div class="text-red-500 p-4 mt-2"></div>'
      const parseResult = Herb.parse(template, { track_whitespace: true })
      const { output } = rewrite(parseResult.value, [sorter])

      expect(output).toBe('<div class="mt-2 p-4 text-red-500"></div>')
    })
  })

  describe("complex templates", () => {
    test("handles ERB expressions", () => {
      const template = '<div class="px-4 <%= extra_classes %> bg-blue-500"></div>'
      const output = rewriteString(Herb, template, [sorter])

      expect(output).toBe('<div class="bg-blue-500 px-4 <%= extra_classes %>"></div>')
    })

    test("handles ERB conditionals", () => {
      const template = '<div class="px-4 <% if admin? %> text-red-500 font-bold <% end %> bg-blue-500"></div>'
      const output = rewriteString(Herb, template, [sorter])

      expect(output).toBe('<div class="bg-blue-500 px-4 <% if admin? %> font-bold text-red-500 <% end %>"></div>')
    })

    test("handles multiline templates", () => {
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

      const expected = `<div class="rounded px-4 <% if valid? %> bg-green-500 font-bold text-green-800 <% else %> bg-red-500 font-bold text-red-800 <% end %>">\n</div>`
      const output = rewriteString(Herb, template, [sorter])

      expect(output).toBe(expected)
    })
  })

  describe("error handling", () => {
    test("continues processing on rewriter error", () => {
      const template = '<div class="text-red-500 p-4"></div>'

      const errorRewriter = sorter
      errorRewriter.rewrite.bind(errorRewriter)

      errorRewriter.rewrite = () => {
        throw new Error("Test error")
      }

      const parseResult = Herb.parse(template, { track_whitespace: true })
      const { output } = rewrite(parseResult.value, [errorRewriter])

      expect(output).toBe(template)
    })
  })

  describe("tailwindClassSorter factory", () => {
    test("creates rewriter with default options", () => {
      const rewriter = sorter

      expect(rewriter.name).toBe("tailwind-class-sorter")
    })

    test("creates rewriter with custom baseDir", async () => {
      const rewriter = await tailwindClassSorter({ baseDir: "/custom/path" })

      expect(rewriter.name).toBe("tailwind-class-sorter")
    })

    test("rewriter has initialize method", async () => {
      const rewriter = sorter

      await expect(
        rewriter.initialize({ baseDir: process.cwd() })
      ).resolves.not.toThrow()
    })
  })
})
