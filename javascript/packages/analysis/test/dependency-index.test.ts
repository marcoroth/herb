import { describe, test, expect, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"

import { affectedNodes, dependencyIndex, referencesState } from "../src/dependency-index"

const FILE = "app/views/posts/show.html.erb"

describe("dependencyIndex", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  function indexOf(source: string) {
    return dependencyIndex(Herb, FILE, source)
  }

  test("follows state into a local assigned from it", () => {
    const nodes = affectedNodes(Herb, `<% total = @items.size %><p><%= total %></p>`, "@items")

    expect(nodes.map(node => node.expression)).toEqual(["total = @items.size", "total"])
  })

  test("follows state through a chain of assignments", () => {
    const nodes = affectedNodes(Herb, `<% a = @items.size %><% b = a * 2 %><p><%= b %></p>`, "@items")

    expect(nodes.map(node => node.expression)).toEqual(["a = @items.size", "b = a * 2", "b"])
  })

  test("leaves a local assigned from something else", () => {
    expect(affectedNodes(Herb, `<% other = 5 %><p><%= other %></p>`, "@items")).toEqual([])
  })

  test("does not take a comparison for an assignment", () => {
    const nodes = affectedNodes(Herb, `<% if @items == other %><p><%= other %></p><% end %>`, "@items")

    expect(nodes.map(node => node.expression)).toEqual(["if @items == other"])
  })

  test("stops a local assigned inside a block at the end of it", () => {
    const nodes = affectedNodes(Herb, `<% @rows.each do |r| %><% inner = r.x %><%= inner %><% end %><%= inner %>`, "@rows")

    expect(nodes.map(node => node.expression)).toEqual(["@rows.each do |r|", "inner = r.x", "inner"])
  })

  test("follows state through a block parameter", () => {
    const nodes = affectedNodes(Herb, `<ul><% @items.each do |item| %><li><%= item.name %></li><% end %></ul>`, "@items")

    expect(nodes.map(node => node.expression)).toContain("item.name")
  })

  test("follows state through every parameter a block binds", () => {
    const nodes = affectedNodes(Herb, `<ul><% @rows.each_with_index do |row, i| %><li><%= i %>: <%= row.title %></li><% end %></ul>`, "@rows")
    const expressions = nodes.map(node => node.expression)

    expect(expressions).toContain("row.title")
    expect(expressions).toContain("i")
  })

  test("leaves an expression a block parameter does not reach", () => {
    const nodes = affectedNodes(Herb, `<div><% @items.each do |item| %><%= other %><% end %></div>`, "@items")

    expect(nodes.map(node => node.expression)).not.toContain("other")
  })

  test("stops a block parameter at the end of its block", () => {
    const nodes = affectedNodes(Herb, `<div><% @items.each do |item| %><%= item.name %><% end %><%= item %></div>`, "@items")
    const expressions = nodes.map(node => node.expression)

    expect(expressions.filter(code => code === "item.name")).toHaveLength(1)
    expect(expressions.filter(code => code === "item")).toHaveLength(0)
  })

  test("reports what the Ruby collector reports", () => {
    const nodes = affectedNodes(Herb, `<ul><% @items.each do |item| %><li><%= item.name %></li><% end %></ul>`, "@items")

    expect(nodes.map(node => [node.kind, node.nodePath, node.expression])).toEqual([
      ["expression", [0, 0], "@items.each do |item|"],
      ["text_content", [0, 0, 0, 0], "item.name"],
    ])
  })

  test("does not confuse a state name with a longer one", () => {
    const nodes = affectedNodes(Herb, `<div><%= @post.title %></div><div><%= @posts.count %></div>`, "@post")

    expect(nodes.map(node => node.expression)).toEqual(["@post.title"])
  })

  test("numbers a node the way SlotVisitor and SubtreeCompiler number it", () => {
    expect(affectedNodes(Herb, `<div><h1><%= @title %></h1></div>`, "@title")[0].nodePath).toEqual([0, 0, 0])
  })

  test("numbers a conditional by the element body it sits in", () => {
    expect(affectedNodes(Herb, `<div><% if @admin %><%= @name %><% end %></div>`, "@admin")[0].nodePath).toEqual([0, 0])
  })

  test("numbers a block by the element body it sits in", () => {
    expect(affectedNodes(Herb, `<ul><% @items.each do |item| %><li>x</li><% end %></ul>`, "@items")[0].nodePath).toEqual([0, 0])
  })

  test("gives an attribute the path of the element that carries it", () => {
    expect(affectedNodes(Herb, `<div class="<%= @klass %>"></div>`, "@klass")[0].nodePath).toEqual([0])
  })

  test("gives a nested attribute the path of its own element", () => {
    expect(affectedNodes(Herb, `<div><a href="<%= @url %>">x</a></div>`, "@url")[0].nodePath).toEqual([0, 0])
  })

  test("maps state to the nodes that read it", () => {
    const index = indexOf(`<div><h1><%= @post.title %></h1><p><%= @post.body %></p></div>`)

    expect(index["@post"]).toBeDefined()
    expect(index["@post"]).toHaveLength(2)
    expect(index["@post"].map(node => node.kind)).toEqual(["text_content", "text_content"])
  })

  test("includes attribute values", () => {
    const index = indexOf(`<div class="<%= @active ? "on" : "off" %>">Content</div>`)

    expect(index["@active"]).toBeDefined()

    const attribute = index["@active"].find(node => node.kind === "attribute_value")

    expect(attribute).toBeDefined()
    expect(attribute?.attribute).toBe("class")
  })

  test("marks an if block containing state as conditional", () => {
    const index = indexOf(`<div><% if @admin %><%= @post.name %><% end %></div>`)

    expect(index["@post"].map(node => node.kind)).toEqual(expect.arrayContaining(["conditional", "text_content"]))
    expect(index["@admin"][0].kind).toBe("conditional")
  })

  test("leaves out state that nothing reads", () => {
    expect(indexOf(`<h1>Static</h1>`)).toEqual({})
  })

  test("records where each node is", () => {
    const [node] = indexOf(`<div><h1><%= @post.title %></h1></div>`)["@post"]

    expect(node.location).toMatch(/^\d+:\d+$/)
    expect(node.expression).toBe("@post.title")
  })

  test("records a path that leads back to the node", () => {
    const [node] = indexOf(`<div><h1><%= @post.title %></h1></div>`)["@post"]

    expect(node.nodePath.length).toBeGreaterThan(0)
    expect(node.nodePath.every(step => Number.isInteger(step))).toBe(true)
  })

  test("covers constants as well as instance variables", () => {
    const index = indexOf(`<%= Post.count %>`)

    expect(index["Post.count"]).toBeDefined()
    expect(index["Post.count"][0].kind).toBe("text_content")
  })

  describe("affectedNodes", () => {
    test("finds nothing for state the template does not read", () => {
      expect(affectedNodes(Herb, `<%= @post.title %>`, "@other")).toEqual([])
    })

    test("finds a render call that passes the state on", () => {
      const nodes = affectedNodes(Herb, `<%= render "posts/card", post: @post %>`, "@post")

      expect(nodes.some(node => node.kind === "render")).toBe(true)
    })
  })

  describe("referencesState", () => {
    test("matches an instance variable literally", () => {
      expect(referencesState("@post.title", "@post")).toBe(true)
      expect(referencesState("@other.title", "@post")).toBe(false)
    })

    test("matches a constant on the constant alone", () => {
      expect(referencesState("Post.where(id: 1)", "Post.count")).toBe(true)
      expect(referencesState("Comment.count", "Post.count")).toBe(false)
    })

    test("matches a plain name on word boundaries", () => {
      expect(referencesState("post.title", "post")).toBe(true)
      expect(referencesState("posts.count", "post")).toBe(false)
    })

    test("is false for nothing", () => {
      expect(referencesState(undefined, "@post")).toBe(false)
      expect(referencesState("@post", "")).toBe(false)
    })
  })
})
