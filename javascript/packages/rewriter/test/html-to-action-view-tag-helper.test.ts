import dedent from "dedent"
import { describe, test, expect, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { IdentityPrinter } from "@herb-tools/printer"
import { HTMLToActionViewTagHelperRewriter } from "@herb-tools/rewriter"

import type { Node } from "@herb-tools/core"

function transform(input: string): string {
  const parseResult = Herb.parse(input, { track_whitespace: true })

  if (parseResult.failed) {
    throw new Error(
      `Parser errors:\n${parseResult.recursiveErrors().map(e => `  - ${e.message}`).join("\n")}`
    )
  }

  const rewriter = new HTMLToActionViewTagHelperRewriter()
  const node = rewriter.rewrite(parseResult.value as Node, { baseDir: process.cwd() })

  return IdentityPrinter.print(node)
}

describe("HTMLToActionViewTagHelperRewriter", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  test("name and description", () => {
    const rewriter = new HTMLToActionViewTagHelperRewriter()
    expect(rewriter.name).toBe("html-to-action-view-tag-helper")
    expect(rewriter.description).toContain("ActionView")
  })

  describe("block form elements", () => {
    test("div with body", () => {
      const input = dedent`
        <div>
          Content
        </div>
      `

      const expected = dedent`
        <%= tag.div do %>
          Content
        <% end %>
      `

      expect(transform(input)).toBe(expected)
    })

    test("div with class attribute", () => {
      const input = dedent`
        <div class="content">
          Content
        </div>
      `

      const expected = dedent`
        <%= tag.div class: "content" do %>
          Content
        <% end %>
      `

      expect(transform(input)).toBe(expected)
    })

    test("div with multiple attributes", () => {
      const input = dedent`
        <div class="content" id="main">
          Content
        </div>
      `

      const expected = dedent`
        <%= tag.div class: "content", id: "main" do %>
          Content
        <% end %>
      `

      expect(transform(input)).toBe(expected)
    })

    test("div with data attributes grouped into hash", () => {
      const input = dedent`
        <div data-controller="content">
          Content
        </div>
      `

      const expected = dedent`
        <%= tag.div data: { controller: "content" } do %>
          Content
        <% end %>
      `

      expect(transform(input)).toBe(expected)
    })

    test("div with multiple data attributes grouped into hash", () => {
      const input = dedent`
        <div data-controller="content" data-user-id="123">
          Content
        </div>
      `

      const expected = dedent`
        <%= tag.div data: { controller: "content", user_id: "123" } do %>
          Content
        <% end %>
      `

      expect(transform(input)).toBe(expected)
    })

    test("div with mixed regular and data attributes", () => {
      const input = dedent`
        <div class="content" data-controller="hello">
          Content
        </div>
      `

      const expected = dedent`
        <%= tag.div class: "content", data: { controller: "hello" } do %>
          Content
        <% end %>
      `

      expect(transform(input)).toBe(expected)
    })

    test("div with aria attributes grouped into hash", () => {
      const input = dedent`
        <div aria-label="Close" aria-hidden="true">
          Content
        </div>
      `

      const expected = dedent`
        <%= tag.div aria: { label: "Close", hidden: "true" } do %>
          Content
        <% end %>
      `

      expect(transform(input)).toBe(expected)
    })
  })

  describe("inline content form", () => {
    test("div with text content only", () => {
      expect(transform('<div>Content</div>')).toBe(
        '<%= tag.div "Content" %>'
      )
    })

    test("div with text content and attributes", () => {
      expect(transform('<div class="content">Hello</div>')).toBe(
        '<%= tag.div "Hello", class: "content" %>'
      )
    })

    test("span with text content", () => {
      expect(transform('<span>text</span>')).toBe(
        '<%= tag.span "text" %>'
      )
    })
  })

  describe("void elements", () => {
    test("br", () => {
      expect(transform("<br>")).toBe("<%= tag.br %>")
    })

    test("br self-closing", () => {
      expect(transform("<br />")).toBe("<%= tag.br %>")
    })

    test("hr with attributes", () => {
      expect(transform('<hr class="divider">')).toBe(
        '<%= tag.hr class: "divider" %>'
      )
    })

    test("img with attributes", () => {
      expect(transform('<img src="image.png" alt="Photo">')).toBe(
        '<%= tag.img src: "image.png", alt: "Photo" %>'
      )
    })
  })

  describe("nested elements", () => {
    test("nested elements are also converted", () => {
      const input = dedent`
        <div class="outer">
          <span>Inner</span>
        </div>
      `

      const expected = dedent`
        <%= tag.div class: "outer" do %>
          <%= tag.span "Inner" %>
        <% end %>
      `

      expect(transform(input)).toBe(expected)
    })
  })

  describe("link_to for anchor tags", () => {
    test("simple link with text and href", () => {
      expect(transform('<a href="/path">Click me</a>')).toBe(
        '<%= link_to "Click me", "/path" %>'
      )
    })

    test("link with href and class", () => {
      expect(transform('<a href="/path" class="btn">Click</a>')).toBe(
        '<%= link_to "Click", "/path", class: "btn" %>'
      )
    })

    test("link with data attributes", () => {
      expect(transform('<a href="/path" data-turbo-method="delete">Delete</a>')).toBe(
        '<%= link_to "Delete", "/path", data: { turbo_method: "delete" } %>'
      )
    })

    test("link with block content", () => {
      const input = dedent`
        <a href="/path" class="btn">
          <span>Icon</span> Click
        </a>
      `

      const expected = dedent`
        <%= link_to "/path", class: "btn" do %>
          <%= tag.span "Icon" %> Click
        <% end %>
      `

      expect(transform(input)).toBe(expected)
    })

    test("link without href", () => {
      expect(transform('<a class="btn">Click</a>')).toBe(
        '<%= link_to "Click", class: "btn" %>'
      )
    })

    test("link with ERB href", () => {
      expect(transform('<a href="<%= user_path(@user) %>">Profile</a>')).toBe(
        '<%= link_to "Profile", user_path(@user) %>'
      )
    })
  })

  describe("turbo_frame_tag for turbo-frame elements", () => {
    test("turbo-frame with id and body", () => {
      const input = dedent`
        <turbo-frame id="tray">
          Content
        </turbo-frame>
      `

      const expected = dedent`
        <%= turbo_frame_tag "tray" do %>
          Content
        <% end %>
      `

      expect(transform(input)).toBe(expected)
    })

    test("turbo-frame with id only", () => {
      expect(transform('<turbo-frame id="tray"></turbo-frame>')).toBe(
        '<%= turbo_frame_tag "tray" %>'
      )
    })

    test("turbo-frame with id and src", () => {
      expect(transform('<turbo-frame id="tray" src="/trays/1"></turbo-frame>')).toBe(
        '<%= turbo_frame_tag "tray", src: "/trays/1" %>'
      )
    })

    test("turbo-frame with id, src and target", () => {
      expect(transform('<turbo-frame id="tray" src="/trays/1" target="_top"></turbo-frame>')).toBe(
        '<%= turbo_frame_tag "tray", src: "/trays/1", target: "_top" %>'
      )
    })

    test("turbo-frame with id and class", () => {
      const input = dedent`
        <turbo-frame id="tray" class="frame">
          Content
        </turbo-frame>
      `

      const expected = dedent`
        <%= turbo_frame_tag "tray", class: "frame" do %>
          Content
        <% end %>
      `

      expect(transform(input)).toBe(expected)
    })

    test("turbo-frame with id and data attributes", () => {
      expect(transform('<turbo-frame id="tray" data-controller="frame"></turbo-frame>')).toBe(
        '<%= turbo_frame_tag "tray", data: { controller: "frame" } %>'
      )
    })

    test("turbo-frame with ERB id", () => {
      const input = dedent`
        <turbo-frame id="<%= dom_id(post) %>">
          Content
        </turbo-frame>
      `

      const expected = dedent`
        <%= turbo_frame_tag dom_id(post) do %>
          Content
        <% end %>
      `

      expect(transform(input)).toBe(expected)
    })

    test("turbo-frame with loading lazy", () => {
      expect(transform('<turbo-frame id="tray" src="/trays/1" loading="lazy"></turbo-frame>')).toBe(
        '<%= turbo_frame_tag "tray", src: "/trays/1", loading: "lazy" %>'
      )
    })

    test("turbo-frame without id", () => {
      const input = dedent`
        <turbo-frame>
          Content
        </turbo-frame>
      `

      const expected = dedent`
        <%= turbo_frame_tag do %>
          Content
        <% end %>
      `

      expect(transform(input)).toBe(expected)
    })
  })

  describe("custom elements with dashes", () => {
    test("trix-editor converts dashes to underscores in method name", () => {
      expect(transform('<trix-editor input="content"></trix-editor>')).toBe(
        '<%= tag.trix_editor input: "content" do %><% end %>'
      )
    })

    test("my-custom-element converts dashes to underscores in method name", () => {
      const input = dedent`
        <my-custom-element data-controller="example">
          Content
        </my-custom-element>
      `

      const expected = dedent`
        <%= tag.my_custom_element data: { controller: "example" } do %>
          Content
        <% end %>
      `

      expect(transform(input)).toBe(expected)
    })
  })

  describe("ERB in attribute values", () => {
    test("single ERB expression becomes Ruby variable", () => {
      expect(transform('<div class="<%= class_name %>">Content</div>')).toBe(
        '<%= tag.div "Content", class: class_name %>'
      )
    })
  })
})
