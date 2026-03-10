import dedent from "dedent"
import { describe, test, expect, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { IdentityPrinter } from "@herb-tools/printer"
import { ActionViewTagHelperToHTMLRewriter } from "@herb-tools/rewriter"

import type { Node } from "@herb-tools/core"

function transform(input: string): string {
  const parseResult = Herb.parse(input, {
    track_whitespace: true,
    action_view_helpers: true,
  })

  if (parseResult.failed) {
    throw new Error(
      `Parser errors:\n${parseResult.recursiveErrors().map(e => `  - ${e.message}`).join("\n")}`
    )
  }

  const rewriter = new ActionViewTagHelperToHTMLRewriter()
  const node = rewriter.rewrite(parseResult.value as Node, { baseDir: process.cwd() })

  return IdentityPrinter.print(node)
}

describe("ActionViewTagHelperToHTMLRewriter", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("name and description", () => {
    const rewriter = new ActionViewTagHelperToHTMLRewriter()
    expect(rewriter.name).toBe("action-view-tag-helper-to-html")
    expect(rewriter.description).toContain("ActionView")
  })

  describe("tag.* helpers", () => {
    test("tag.div with block", () => {
      const input = dedent`
        <%= tag.div do %>
          Content
        <% end %>
      `

      const expected = dedent`
        <div>
          Content
        </div>
      `

      expect(transform(input)).toBe(expected)
    })

    test("tag.div with content as argument", () => {
      expect(transform('<%= tag.div "Content" %>')).toBe(
        "<div>Content</div>"
      )
    })

    test("tag.div with attributes", () => {
      const input = dedent`
        <%= tag.div class: "content" do %>
          Content
        <% end %>
      `

      const expected = dedent`
        <div class="content">
          Content
        </div>
      `

      expect(transform(input)).toBe(expected)
    })

    test("tag.div with content as argument and attributes", () => {
      expect(transform('<%= tag.div "Content", class: "content" %>')).toBe(
        '<div class="content">Content</div>'
      )
    })

    test("tag.div with multiple attributes", () => {
      const input = dedent`
        <%= tag.div class: "content", id: "main" do %>
          Content
        <% end %>
      `

      const expected = dedent`
        <div class="content" id="main">
          Content
        </div>
      `

      expect(transform(input)).toBe(expected)
    })

    test("tag.div with data attributes in hash style", () => {
      const input = dedent`
        <%= tag.div data: { controller: "content" } do %>
          Content
        <% end %>
      `

      const expected = dedent`
        <div data-controller="content">
          Content
        </div>
      `

      expect(transform(input)).toBe(expected)
    })

    test("tag.div with variable attribute value wraps in ERB", () => {
      const input = dedent`
        <%= tag.div class: class_name do %>
          Content
        <% end %>
      `

      const expected = dedent`
        <div class="<%= class_name %>">
          Content
        </div>
      `

      expect(transform(input)).toBe(expected)
    })

    test("tag.div with data attribute ruby literal value", () => {
      const input = dedent`
        <%= tag.div data: { controller: "content", user_id: 123 } do %>
          Content
        <% end %>
      `

      const expected = dedent`
        <div data-controller="content" data-user-id="<%= 123 %>">
          Content
        </div>
      `

      expect(transform(input)).toBe(expected)
    })

    test("tag.br void element", () => {
      expect(transform("<%= tag.br %>")).toBe("<br />")
    })

    test("tag.hr void element with attributes", () => {
      expect(transform('<%= tag.hr class: "divider" %>')).toBe(
        '<hr class="divider" />'
      )
    })

    test("tag.img void element with attributes", () => {
      expect(transform('<%= tag.img src: "image.png", alt: "Photo" %>')).toBe(
        '<img src="image.png" alt="Photo" />'
      )
    })

    test("tag.div with splat attributes", () => {
      const input = dedent`
        <%= tag.div class: "content", **attributes do %>
          Content
        <% end %>
      `

      const expected = dedent`
        <div class="content" <%= **attributes %>>
          Content
        </div>
      `

      expect(transform(input)).toBe(expected)
    })
  })

  describe("nested helpers", () => {
    test("nested tag helpers are also converted", () => {
      const input = dedent`
        <%= tag.div class: "outer" do %>
          <%= tag.span "Inner" %>
        <% end %>
      `

      const expected = dedent`
        <div class="outer">
          <span>Inner</span>
        </div>
      `

      expect(transform(input)).toBe(expected)
    })
  })

  describe("non-ActionView elements", () => {
    test("regular HTML elements are not modified", () => {
      expect(transform('<div class="content">Hello</div>')).toBe(
        '<div class="content">Hello</div>'
      )
    })

    test("regular ERB expressions are not modified", () => {
      expect(transform("<%= some_method %>")).toBe(
        "<%= some_method %>"
      )
    })
  })
})
