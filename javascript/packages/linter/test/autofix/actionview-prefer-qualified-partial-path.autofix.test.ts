import dedent from "dedent"
import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { PartialIndex } from "@herb-tools/analysis"
import { Linter } from "../../src/linter.js"
import { ActionViewPreferQualifiedPartialPathRule } from "../../src/rules/actionview-prefer-qualified-partial-path.js"

import type { PartialDeclaration } from "@herb-tools/analysis"

function declaration(file: string): PartialDeclaration {
  return { file, hasDeclaration: false, hasKeywordRest: false, locals: [] }
}

const partials = new PartialIndex(["app/views"], new Map([
  ["posts/card", declaration("app/views/posts/_card.html.erb")],
  ["posts/row", declaration("app/views/posts/_row.html.erb")],
  ["application/flash", declaration("app/views/application/_flash.html.erb")],
]))

const context = { fileName: "app/views/posts/index.html.erb", framework: "actionview" as const, partials }

function fix(source: string, options: { includeUnsafe?: boolean, context?: any } = {}) {
  const linter = new Linter(Herb, [ActionViewPreferQualifiedPartialPathRule])

  return linter.autofix(source, options.context ?? context, undefined, { includeUnsafe: options.includeUnsafe ?? true })
}

describe("actionview-prefer-qualified-partial-path autofix", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("qualifies a partial sitting next to the template", () => {
    const result = fix(`<%= render "card" %>`)

    expect(result.source).toBe(`<%= render "posts/card" %>`)
    expect(result.fixed).toHaveLength(1)
    expect(result.unfixed).toHaveLength(0)
  })

  test("qualifies the keyword form", () => {
    const result = fix(`<%= render partial: "card", locals: { post: @post } %>`)

    expect(result.source).toBe(`<%= render partial: "posts/card", locals: { post: @post } %>`)
  })

  test("qualifies the hash rocket form", () => {
    const result = fix(`<%= render :partial => "card" %>`)

    expect(result.source).toBe(`<%= render :partial => "posts/card" %>`)
  })

  test("keeps single quotes", () => {
    const result = fix(`<%= render 'card' %>`)

    expect(result.source).toBe(`<%= render 'posts/card' %>`)
  })

  test("qualifies a render that takes a block", () => {
    const result = fix(dedent`
      <%= render "card" do %>
        <p>body</p>
      <% end %>
    `)

    expect(result.source).toBe(dedent`
      <%= render "posts/card" do %>
        <p>body</p>
      <% end %>
    `)
  })

  test("qualifies a render nested in markup", () => {
    const result = fix(dedent`
      <div class="row">
        <%= render "card" %>
      </div>
    `)

    expect(result.source).toBe(dedent`
      <div class="row">
        <%= render "posts/card" %>
      </div>
    `)
  })

  test("qualifies every render in the file", () => {
    const result = fix(dedent`
      <%= render "card" %>
      <%= render "row" %>
    `)

    expect(result.source).toBe(dedent`
      <%= render "posts/card" %>
      <%= render "posts/row" %>
    `)
    expect(result.fixed).toHaveLength(2)
  })

  test("qualifies a partial rendered from a partial in the same directory", () => {
    const result = fix(`<%= render "card" %>`, { context: { fileName: "app/views/posts/_list.html.erb", framework: "actionview", partials } })

    expect(result.source).toBe(`<%= render "posts/card" %>`)
  })

  test("does not fix without includeUnsafe", () => {
    const result = fix(`<%= render "card" %>`, { includeUnsafe: false })

    expect(result.source).toBe(`<%= render "card" %>`)
    expect(result.fixed).toHaveLength(0)
    expect(result.unfixed).toHaveLength(1)
  })

  test("does not fix a partial resolved from the application directory", () => {
    const result = fix(`<%= render "flash" %>`)

    expect(result.source).toBe(`<%= render "flash" %>`)
    expect(result.fixed).toHaveLength(0)
    expect(result.unfixed).toHaveLength(1)
  })

  test("does not fix when the partial does not resolve", () => {
    const result = fix(`<%= render "missing" %>`)

    expect(result.source).toBe(`<%= render "missing" %>`)
    expect(result.fixed).toHaveLength(0)
  })

  test("does not fix without a partial index", () => {
    const result = fix(`<%= render "card" %>`, { context: { fileName: "app/views/posts/index.html.erb" } })

    expect(result.source).toBe(`<%= render "card" %>`)
    expect(result.fixed).toHaveLength(0)
  })

  test("does not fix without a file name", () => {
    const result = fix(`<%= render "card" %>`, { context: { partials } })

    expect(result.source).toBe(`<%= render "card" %>`)
    expect(result.fixed).toHaveLength(0)
  })

  test("does not fix when the name appears twice in the same tag", () => {
    const result = fix(`<%= render "card", kind: "card" %>`)

    expect(result.source).toBe(`<%= render "card", kind: "card" %>`)
    expect(result.fixed).toHaveLength(0)
    expect(result.unfixed).toHaveLength(1)
  })
})
