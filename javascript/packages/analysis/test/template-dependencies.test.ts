import { describe, test, expect, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"

import { collectTemplateDependencies } from "../src/template-dependencies"

import type { DependencyOptions, TemplateDependencies } from "../src/template-dependencies"

describe("collectTemplateDependencies", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  function analyze(source: string, options: DependencyOptions = {}): TemplateDependencies {
    return collectTemplateDependencies(Herb, "app/views/posts/show.html.erb", source, options)
  }

  describe("instance variables", () => {
    test("detects instance variables", () => {
      const result = analyze(`<h1><%= @post.title %></h1><p><%= @user.name %></p>`)

      expect(result.instanceVariables).toContain("@post")
      expect(result.instanceVariables).toContain("@user")
    })

    test("detects instance variables in conditionals", () => {
      expect(analyze(`<% if @admin %><p>Admin</p><% end %>`).instanceVariables).toContain("@admin")
    })

    test("detects instance variables inside string interpolation", () => {
      expect(analyze(`<%= "Hello #{@name}" %>`).instanceVariables).toContain("@name")
    })

    test("detects multiple instance variables in a ternary", () => {
      const result = analyze(`<%= @admin ? @admin_name : @guest_name %>`)

      expect(result.instanceVariables).toEqual(expect.arrayContaining(["@admin", "@admin_name", "@guest_name"]))
    })

    test("deduplicates instance variables", () => {
      expect(analyze(`<%= @post.title %><%= @post.body %>`).instanceVariables).toEqual(["@post"])
    })
  })

  describe("constants", () => {
    test("detects constants with method calls", () => {
      const result = analyze(`<%= Current.user %><%= Post.count %>`)

      expect(result.constants).toContain("Current.user")
      expect(result.constants).toContain("Post.count")
    })

    test("detects constants in conditionals", () => {
      expect(analyze(`<% if Current.user %><p>Logged in</p><% end %>`).constants).toContain("Current.user")
    })
  })

  describe("locals", () => {
    test("detects strict locals", () => {
      const result = collectTemplateDependencies(Herb, "app/views/posts/_card.html.erb",
        `<%# locals: (title:, body:) %>\n<h1><%= title %></h1>`)

      expect(result.localsDeclared).toContain("title")
      expect(result.localsDeclared).toContain("body")
    })

    test("does not flag declared locals as unknown", () => {
      const result = collectTemplateDependencies(Herb, "app/views/posts/_card.html.erb",
        `<%# locals: (title:) %>\n<%= title %>`)

      expect(result.unknownCalls).toEqual([])
      expect(result.localsDeclared).toContain("title")
    })

    test("detects locals passed to render calls", () => {
      expect(analyze(`<%= render "shared/header", title: @post.title %>`).localsReceived.title).toBe("@post.title")
    })

    test("tracks instance variables from render local values", () => {
      const result = analyze(`<%= render "shared/header", user: @current_user %>`)

      expect(result.instanceVariables).toContain("@current_user")
      expect(result.localsReceived.user).toBe("@current_user")
    })
  })

  describe("helper and unknown calls", () => {
    test("detects known Action View helpers", () => {
      expect(analyze(`<%= link_to "Home", "/" %>`).helperCalls).toContain("link_to")
    })

    test("detects custom helpers once they are known", () => {
      const result = analyze(`<%= markdown(@post.body) %>`, { customHelpers: ["markdown"] })

      expect(result.helperCalls).toContain("markdown")
      expect(result.unknownCalls).not.toContain("markdown")
    })

    test("flags unknown method calls", () => {
      expect(analyze(`<%= current_user.name %>`).unknownCalls).toContain("current_user")
    })

    test("does not flag template defined locals as unknown", () => {
      expect(analyze(`<% total = 1 %><%= total %>`).unknownCalls).not.toContain("total")
    })

    test("does not flag block parameters as unknown", () => {
      expect(analyze(`<% @posts.each do |post| %><%= post.title %><% end %>`).unknownCalls).not.toContain("post")
    })

    test("does not flag nested block parameters as unknown", () => {
      const source = `<% @posts.each do |post| %><% post.tags.each do |tag| %><%= tag.name %><% end %><% end %>`

      expect(analyze(source).unknownCalls).not.toContain("tag")
    })

    test("conditional assignment registers as a local", () => {
      expect(analyze(`<% total ||= 0 %><%= total %>`).unknownCalls).not.toContain("total")
    })

    test("operator assignment registers as a local", () => {
      expect(analyze(`<% count = 0 %><% count += 1 %><%= count %>`).unknownCalls).not.toContain("count")
    })
  })

  describe("render calls", () => {
    test("tracks render calls with partials and locals", () => {
      const [call] = analyze(`<%= render "shared/header", title: @post.title %>`).renderCalls

      expect(call.partial).toBe("shared/header")
      expect(call.locals.title).toBe("@post.title")
    })

    test("detects collection expression dependencies", () => {
      const [call] = analyze(`<%= render partial: "posts/post", collection: @posts %>`).renderCalls

      expect(call.partial).toBe("posts/post")
      expect(call.collection).toBe("@posts")
    })
  })
})
