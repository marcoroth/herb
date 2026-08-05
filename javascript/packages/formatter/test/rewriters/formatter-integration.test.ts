import dedent from "dedent"

import { describe, test, expect, beforeAll } from "vitest"
import { loadRewritersHelper } from "./helpers"

import { Herb } from "@herb-tools/node-wasm"
import { Formatter } from "../../src/formatter"

describe("Formatter with Rewriters Integration", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("formats without rewriters when none loaded", () => {
    const formatter = new Formatter(Herb, { indentWidth: 2, maxLineLength: 80 })

    const source = dedent`
      <div class="px-4 bg-blue-500 text-white rounded py-2"></div>
    `

    const result = formatter.format(source)

    expect(result).toBeDefined()
    expect(result).toContain(`<div class="px-4 bg-blue-500 text-white rounded py-2"></div>`)
  })

  test("loadRewriters with empty options succeeds", async () => {
    const info = await loadRewritersHelper({
      baseDir: process.cwd(),
      pre: [],
      post: []
    })

    expect(info.preCount).toBe(0)
    expect(info.postCount).toBe(0)
    expect(info.warnings).toEqual([])
  })

  test("loadRewriters with Tailwind class sorter", async () => {
    const info = await loadRewritersHelper({
      baseDir: process.cwd(),
      pre: ["tailwind-class-sorter"],
      post: [],
      loadCustomRewriters: false
    })

    expect(info.preCount).toBe(1)
    expect(info.postCount).toBe(0)
  })

  test("formats with Tailwind class sorter enabled", async () => {
    const { preRewriters, postRewriters } = await loadRewritersHelper({
      baseDir: process.cwd(),
      pre: ["tailwind-class-sorter"],
      loadCustomRewriters: false
    })

    const formatter = new Formatter(Herb, { indentWidth: 2, maxLineLength: 80, preRewriters, postRewriters })

    const source = dedent`
      <div class="px-4 bg-blue-500 text-white rounded py-2"></div>
    `

    const result = formatter.format(source)

    expect(result).toBeDefined()
    expect(result).toBe(`<div class="rounded bg-blue-500 px-4 py-2 text-white"></div>`)
  })

  test("handles unknown rewriter gracefully", async () => {
    const info = await loadRewritersHelper({
      baseDir: process.cwd(),
      pre: ["non-existent-rewriter"],
      loadCustomRewriters: false
    })

    expect(info.preCount).toBe(0)
    expect(info.warnings.length).toBeGreaterThan(0)
    expect(info.warnings[0]).toContain("not found")
  })

  test("loadRewriters is idempotent", async () => {
    const info1 = await loadRewritersHelper({
      baseDir: process.cwd(),
      pre: ["tailwind-class-sorter"],
      loadCustomRewriters: false
    })

    const info2 = await loadRewritersHelper({
      baseDir: process.cwd(),
      pre: ["tailwind-class-sorter"],
      loadCustomRewriters: false
    })

    expect(info1.preCount).toBe(info2.preCount)
  })

  test("format works with file path parameter", async () => {
    const { preRewriters, postRewriters } = await loadRewritersHelper({
      baseDir: process.cwd(),
      pre: ["tailwind-class-sorter"],
      loadCustomRewriters: false
    })

    const formatter = new Formatter(Herb, { indentWidth: 2, preRewriters, postRewriters })

    const source = dedent`
      <div class="px-4 bg-blue-500"></div>
    `

    const result = formatter.format(source, {}, "path/to/file.html.erb")

    expect(result).toBeDefined()
  })

  test("continues formatting even if rewriter fails", async () => {
    const { preRewriters, postRewriters } = await loadRewritersHelper({
      baseDir: process.cwd(),
      pre: ["tailwind-class-sorter"],
      loadCustomRewriters: false
    })

    const formatter = new Formatter(Herb, { indentWidth: 2, preRewriters, postRewriters })

    const source = dedent`
      <div class="px-4">
        <span>Content</span>
      </div>
    `

    const result = formatter.format(source)

    expect(result).toBeDefined()
  })

  test("loadCustomRewriters defaults to true", async () => {
    const info = await loadRewritersHelper({
      baseDir: process.cwd(),
      pre: []
    })

    expect(info).toBeDefined()
  })

  test("formats complex ERB with rewriters", async () => {
    const { preRewriters, postRewriters } = await loadRewritersHelper({
      baseDir: process.cwd(),
      pre: ["tailwind-class-sorter"],
      loadCustomRewriters: false
    })

    const formatter = new Formatter(Herb, { indentWidth: 2, maxLineLength: 80, preRewriters, postRewriters })

    const source = dedent`
      <div class="px-4 bg-blue-500">
        <% if user.admin? %>
          <span class="text-white font-bold">Admin</span>
        <% else %>
          <span class="text-gray-500">User</span>
        <% end %>
      </div>
    `

    const result = formatter.format(source)

    expect(result).toBe(dedent`
      <div class="bg-blue-500 px-4">
        <% if user.admin? %>
          <span class="font-bold text-white">Admin</span>
        <% else %>
          <span class="text-gray-500">User</span>
        <% end %>
      </div>
    `)
  })
})
