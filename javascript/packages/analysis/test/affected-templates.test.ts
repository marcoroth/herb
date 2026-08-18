import { describe, test, expect, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"

import { affectedTemplates, expressionReferences } from "../src/affected-templates"
import { collectTemplateDependencies } from "../src/template-dependencies"

import type { TemplateGraph } from "../src/affected-templates"

describe("affectedTemplates", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  function graphOf(files: Record<string, string>): TemplateGraph {
    const dependencies = new Map(
      Object.entries(files).map(([file, source]) => [file, collectTemplateDependencies(Herb, file, source)])
    )

    const byPartial = new Map<string, string[]>()

    for (const file of Object.keys(files)) {
      const name = file.replace(/^app\/views\//, "").replace(/\/_/, "/").replace(/\.html\.erb$/, "")

      if (!file.split("/").pop()!.startsWith("_")) continue

      byPartial.set(name, [...(byPartial.get(name) ?? []), file])
    }

    return { dependencies, filesForPartial: name => byPartial.get(name) ?? [] }
  }

  test("traces state through the render graph", () => {
    const graph = graphOf({
      "app/views/posts/show.html.erb": `<%= @post.title %><%= render "posts/header", post: @post %>`,
      "app/views/posts/_header.html.erb": `<h1><%= post.name %></h1>`,
    })

    const affected = affectedTemplates(graph, "app/views/posts/show.html.erb", "@post")

    expect(affected).toContain("app/views/posts/show.html.erb")
    expect(affected).toContain("app/views/posts/_header.html.erb")
  })

  test("does not include unrelated templates", () => {
    const graph = graphOf({
      "app/views/posts/show.html.erb": `<%= @post.title %><%= render "posts/header", post: @post %>`,
      "app/views/posts/_header.html.erb": `<h1><%= post.name %></h1>`,
      "app/views/pages/about.html.erb": `<h1>About</h1>`,
    })

    expect(affectedTemplates(graph, "app/views/posts/show.html.erb", "@post")).not.toContain("app/views/pages/about.html.erb")
  })

  test("traces through nested renders", () => {
    const graph = graphOf({
      "app/views/posts/show.html.erb": `<%= render "posts/header", post: @post %>`,
      "app/views/posts/_header.html.erb": `<%= render "posts/title", title: post.title %>`,
      "app/views/posts/_title.html.erb": `<h1><%= title %></h1>`,
    })

    const affected = affectedTemplates(graph, "app/views/posts/show.html.erb", "@post")

    expect(affected).toContain("app/views/posts/show.html.erb")
    expect(affected).toContain("app/views/posts/_header.html.erb")
    expect(affected).toContain("app/views/posts/_title.html.erb")
  })

  test("handles constants", () => {
    const graph = graphOf({ "app/views/posts/index.html.erb": `<%= Post.count %>` })

    expect(affectedTemplates(graph, "app/views/posts/index.html.erb", "Post.count")).toContain("app/views/posts/index.html.erb")
  })

  test("returns nothing when the entry point does not read the state", () => {
    const graph = graphOf({
      "app/views/posts/show.html.erb": `<%= @other.title %><%= render "posts/header", post: @other %>`,
      "app/views/posts/_header.html.erb": `<h1><%= post.name %></h1>`,
    })

    expect(affectedTemplates(graph, "app/views/posts/show.html.erb", "@post")).toEqual([])
  })

  test("returns nothing for a template it does not know", () => {
    expect(affectedTemplates(graphOf({}), "app/views/posts/show.html.erb", "@post")).toEqual([])
  })

  test("stops where the state stops flowing", () => {
    const graph = graphOf({
      "app/views/posts/show.html.erb": `<%= @post.title %><%= render "posts/header", title: "static" %>`,
      "app/views/posts/_header.html.erb": `<h1><%= title %></h1>`,
    })

    const affected = affectedTemplates(graph, "app/views/posts/show.html.erb", "@post")

    expect(affected).toEqual(["app/views/posts/show.html.erb"])
  })

  test("follows a collection through to the partial", () => {
    const graph = graphOf({
      "app/views/posts/index.html.erb": `<%= @posts.count %><%= render partial: "posts/post", collection: @posts %>`,
      "app/views/posts/_post.html.erb": `<%= post.title %>`,
    })

    expect(affectedTemplates(graph, "app/views/posts/index.html.erb", "@posts")).toContain("app/views/posts/_post.html.erb")
  })

  describe("expressionReferences", () => {
    test("matches an instance variable literally", () => {
      expect(expressionReferences("@post.title", "@post")).toBe(true)
      expect(expressionReferences("@poster.title", "@post")).toBe(true)
    })

    test("matches a local on word boundaries", () => {
      expect(expressionReferences("post.title", "post")).toBe(true)
      expect(expressionReferences("posts.count", "post")).toBe(false)
      expect(expressionReferences("post_id", "post")).toBe(false)
    })

    test("is false for nothing", () => {
      expect(expressionReferences(undefined, "post")).toBe(false)
      expect(expressionReferences("post.title", "")).toBe(false)
    })
  })
})
