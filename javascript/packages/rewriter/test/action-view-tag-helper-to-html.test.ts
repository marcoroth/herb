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

    test("tag.div with shorthand keyword arguments wraps each in ERB", () => {
      expect(transform('<%= tag.div(height:, width:) %>')).toBe(
        '<div height="<%= height %>" width="<%= width %>"></div>'
      )
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

    test("tag.details with inline block", () => {
      expect(transform('<%= tag.details { "Some content" } %>')).toBe(
        "<details>Some content</details>"
      )
    })

    test("tag.div with inline block and attributes", () => {
      expect(transform('<%= tag.div(class: "container") { "Hello" } %>')).toBe(
        '<div class="container">Hello</div>'
      )
    })

    test("tag.p with inline block and ruby expression", () => {
      expect(transform('<%= tag.p { @user.name } %>')).toBe(
        "<p><%= @user.name %></p>"
      )
    })

    test("tag.div with content argument and block prefers block content", () => {
      expect(transform('<%= tag.div("argument") { "Block" } %>')).toBe(
        "<div>Block</div>"
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

  describe("content_tag helpers", () => {
    test("content_tag with inline block", () => {
      expect(transform('<%= content_tag(:details) { "Some content" } %>')).toBe(
        "<details>Some content</details>"
      )
    })

    test("content_tag with inline block and attributes", () => {
      expect(transform('<%= content_tag(:div, class: "container") { "Hello" } %>')).toBe(
        '<div class="container">Hello</div>'
      )
    })

    test("content_tag with inline block and ruby expression", () => {
      expect(transform('<%= content_tag(:p) { @user.name } %>')).toBe(
        "<p><%= @user.name %></p>"
      )
    })

    test("content_tag with content argument and block prefers block content", () => {
      expect(transform('<%= content_tag(:div, "argument") { "Block" } %>')).toBe(
        "<div>Block</div>"
      )
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

  describe("link_to helpers", () => {
    test("link_to with path only", () => {
      expect(transform("<%= link_to root_path %>")).toBe(
        '<a href="<%= root_path %>"><%= root_path.to_s %></a>'
      )
    })

    test("link_to with model", () => {
      expect(transform("<%= link_to @profile %>")).toBe(
        '<a href="<%= url_for(@profile) %>"><%= @profile.to_s %></a>'
      )
    })

    test("link_to with :back", () => {
      expect(transform('<%= link_to "Back", :back %>')).toBe(
        '<a href="<%= url_for(:back) %>">Back</a>'
      )
    })

    test("link_to with inline block", () => {
      expect(transform('<%= link_to("#") { "Click me" } %>')).toBe(
        '<a href="#">Click me</a>'
      )
    })

    test("link_to with inline block and attributes", () => {
      expect(transform('<%= link_to("/about", class: "btn") { "About" } %>')).toBe(
        '<a href="/about" class="btn">About</a>'
      )
    })

    test("link_to with inline block and ruby expression", () => {
      expect(transform('<%= link_to("#") { @user.name } %>')).toBe(
        '<a href="#"><%= @user.name %></a>'
      )
    })

    test("link_to with content argument and block prefers block content", () => {
      expect(transform('<%= link_to("#", "argument") { "Block" } %>')).toBe(
        `<a href="#">Block</a>`
      )
    })
  })

  describe("turbo_frame_tag helpers", () => {
    test("turbo_frame_tag with block", () => {
      const input = dedent`
        <%= turbo_frame_tag "tray" do %>
          Content
        <% end %>
      `

      const expected = dedent`
        <turbo-frame id="tray">
          Content
        </turbo-frame>
      `

      expect(transform(input)).toBe(expected)
    })

    test("turbo_frame_tag without block", () => {
      expect(transform('<%= turbo_frame_tag "tray" %>')).toBe(
        '<turbo-frame id="tray"></turbo-frame>'
      )
    })

    test("turbo_frame_tag with src attribute", () => {
      expect(transform('<%= turbo_frame_tag "tray", src: tray_path(tray) %>')).toBe(
        '<turbo-frame id="tray" src="<%= tray_path(tray) %>"></turbo-frame>'
      )
    })

    test("turbo_frame_tag with src and target attributes", () => {
      expect(transform('<%= turbo_frame_tag "tray", src: tray_path(tray), target: "_top" %>')).toBe(
        '<turbo-frame id="tray" src="<%= tray_path(tray) %>" target="_top"></turbo-frame>'
      )
    })

    test("turbo_frame_tag with loading lazy", () => {
      expect(transform('<%= turbo_frame_tag "tray", src: tray_path(tray), loading: "lazy" %>')).toBe(
        '<turbo-frame id="tray" src="<%= tray_path(tray) %>" loading="lazy"></turbo-frame>'
      )
    })

    test("turbo_frame_tag with class attribute and block", () => {
      const input = dedent`
        <%= turbo_frame_tag "tray", class: "frame" do %>
          Content
        <% end %>
      `

      const expected = dedent`
        <turbo-frame id="tray" class="frame">
          Content
        </turbo-frame>
      `

      expect(transform(input)).toBe(expected)
    })

    test("turbo_frame_tag with variable id", () => {
      const input = dedent`
        <%= turbo_frame_tag dom_id(post) do %>
          Content
        <% end %>
      `

      const expected = dedent`
        <turbo-frame id="<%= dom_id(post) %>">
          Content
        </turbo-frame>
      `

      expect(transform(input)).toBe(expected)
    })

    test("turbo_frame_tag with data attributes", () => {
      const input = dedent`
        <%= turbo_frame_tag "tray", data: { controller: "frame" } do %>
          Content
        <% end %>
      `

      const expected = dedent`
        <turbo-frame id="tray" data-controller="frame">
          Content
        </turbo-frame>
      `

      expect(transform(input)).toBe(expected)
    })

    test("turbo_frame_tag with splat attributes", () => {
      const input = dedent`
        <%= turbo_frame_tag "tray", **attributes do %>
          Content
        <% end %>
      `

      const expected = dedent`
        <turbo-frame id="tray" <%= **attributes %>>
          Content
        </turbo-frame>
      `

      expect(transform(input)).toBe(expected)
    })
  })

  describe("javascript_tag helpers", () => {
    test("javascript_tag with content as argument", () => {
      expect(transform(`<%= javascript_tag "alert('Hello')" %>`)).toBe(
        `<script>alert('Hello')</script>`
      )
    })

    test("javascript_tag with block", () => {
      const input = dedent`
        <%= javascript_tag do %>
          alert('Hello')
        <% end %>
      `

      const expected = dedent`
        <script>
          alert('Hello')
        </script>
      `

      expect(transform(input)).toBe(expected)
    })

    test("javascript_tag with type attribute", () => {
      expect(transform(`<%= javascript_tag "alert('Hello')", type: "application/javascript" %>`)).toBe(
        `<script type="application/javascript">alert('Hello')</script>`
      )
    })
  })

  describe("javascript_include_tag helpers", () => {
    test("javascript_include_tag with single source", () => {
      expect(transform(`<%= javascript_include_tag "application" %>`)).toBe(
        `<script src="<%= javascript_path("application") %>"></script>`
      )
    })

    test("javascript_include_tag with defer", () => {
      expect(transform(`<%= javascript_include_tag "application", defer: true %>`)).toBe(
        `<script src="<%= javascript_path("application") %>" defer></script>`
      )
    })

    test("javascript_include_tag with multiple sources", () => {
      expect(transform(`<%= javascript_include_tag "application", "vendor" %>`)).toBe(
        dedent`
          <script src="<%= javascript_path("application") %>"></script>
          <script src="<%= javascript_path("vendor") %>"></script>
        `
      )
    })

    test("javascript_include_tag with nonce", () => {
      expect(transform(`<%= javascript_include_tag "application", nonce: true %>`)).toBe(
        `<script src="<%= javascript_path("application") %>" nonce="true"></script>`
      )
    })

    test("javascript_include_tag with nonce false", () => {
      expect(transform(`<%= javascript_include_tag "application", nonce: false %>`)).toBe(
        `<script src="<%= javascript_path("application") %>" nonce="false"></script>`
      )
    })

    test("javascript_include_tag with interpolated nonce", () => {
      expect(transform('<%= javascript_include_tag "application", nonce: "static-#{dynamic}" %>')).toBe(
        '<script src="<%= javascript_path("application") %>" nonce="static-<%= dynamic %>"></script>'
      )
    })

    test("javascript_include_tag with data attributes", () => {
      expect(transform(`<%= javascript_include_tag "application", data: { turbo_track: "reload" } %>`)).toBe(
        `<script src="<%= javascript_path("application") %>" data-turbo-track="reload"></script>`
      )
    })

    test("javascript_include_tag with .js extension", () => {
      expect(transform(`<%= javascript_include_tag "xmlhr.js" %>`)).toBe(
        `<script src="<%= javascript_path("xmlhr.js") %>"></script>`
      )
    })

    test("javascript_include_tag with URL", () => {
      expect(transform(`<%= javascript_include_tag "http://www.example.com/xmlhr" %>`)).toBe(
        `<script src="http://www.example.com/xmlhr"></script>`
      )
    })

    test("javascript_include_tag with URL ending in .js", () => {
      expect(transform(`<%= javascript_include_tag "http://www.example.com/xmlhr.js" %>`)).toBe(
        `<script src="http://www.example.com/xmlhr.js"></script>`
      )
    })

    test("javascript_include_tag with protocol-relative URL", () => {
      expect(transform(`<%= javascript_include_tag "//cdn.example.com/app.js" %>`)).toBe(
        `<script src="//cdn.example.com/app.js"></script>`
      )
    })

    test("javascript_include_tag with URL and nonce", () => {
      expect(transform(`<%= javascript_include_tag "http://www.example.com/xmlhr.js", nonce: true %>`)).toBe(
        `<script src="http://www.example.com/xmlhr.js" nonce="true"></script>`
      )
    })

    test("javascript_include_tag with URL and async", () => {
      expect(transform(`<%= javascript_include_tag "http://www.example.com/xmlhr.js", async: true %>`)).toBe(
        `<script src="http://www.example.com/xmlhr.js" async></script>`
      )
    })

    test("javascript_include_tag with URL and defer", () => {
      expect(transform(`<%= javascript_include_tag "http://www.example.com/xmlhr.js", defer: true %>`)).toBe(
        `<script src="http://www.example.com/xmlhr.js" defer></script>`
      )
    })

    test("javascript_include_tag with defer as string", () => {
      expect(transform(`<%= javascript_include_tag "application", defer: "true" %>`)).toBe(
        `<script src="<%= javascript_path("application") %>" defer="true"></script>`
      )
    })

    test("javascript_include_tag with extname false", () => {
      expect(transform(`<%= javascript_include_tag "template.jst", extname: false %>`)).toBe(
        `<script src="<%= javascript_path("template.jst") %>" extname="false"></script>`
      )
    })

    test("javascript_include_tag with host and protocol", () => {
      expect(transform(`<%= javascript_include_tag "xmlhr", host: "localhost", protocol: "https" %>`)).toBe(
        `<script src="<%= javascript_path("xmlhr") %>" host="localhost" protocol="https"></script>`
      )
    })

    test("javascript_include_tag with multiple sources including path", () => {
      expect(transform(`<%= javascript_include_tag "common.javascript", "/elsewhere/cools" %>`)).toBe(
        dedent`
          <script src="<%= javascript_path("common.javascript") %>"></script>
          <script src="<%= javascript_path("/elsewhere/cools") %>"></script>
        `
      )
    })

    test("javascript_include_tag with asset_path", () => {
      expect(transform(`<%= javascript_include_tag asset_path("application.js") %>`)).toBe(
        `<script src="<%= asset_path("application.js") %>"></script>`
      )
    })
  })

  describe("image_tag helpers", () => {
    test("image_tag with string source", () => {
      expect(transform('<%= image_tag "icon.png" %>')).toBe(
        '<img src="<%= image_path("icon.png") %>" />'
      )
    })

    test("image_tag with alt attribute", () => {
      expect(transform('<%= image_tag "icon.png", alt: "Icon" %>')).toBe(
        '<img src="<%= image_path("icon.png") %>" alt="Icon" />'
      )
    })

    test("image_tag with multiple attributes", () => {
      expect(transform('<%= image_tag "photo.jpg", alt: "Photo", class: "avatar" %>')).toBe(
        '<img src="<%= image_path("photo.jpg") %>" alt="Photo" class="avatar" />'
      )
    })

    test("image_tag with URL source", () => {
      expect(transform('<%= image_tag "http://example.com/icon.png" %>')).toBe(
        '<img src="http://example.com/icon.png" />'
      )
    })

    test("image_tag with protocol-relative URL", () => {
      expect(transform('<%= image_tag "//cdn.example.com/icon.png" %>')).toBe(
        '<img src="//cdn.example.com/icon.png" />'
      )
    })

    test("image_tag with ruby expression source wraps in image_path", () => {
      expect(transform('<%= image_tag user.avatar %>')).toBe(
        '<img src="<%= image_path(user.avatar) %>" />'
      )
    })

    test("image_tag with image_path source passes through", () => {
      expect(transform('<%= image_tag image_path("icon.png") %>')).toBe(
        '<img src="<%= image_path("icon.png") %>" />'
      )
    })

    test("image_tag with asset_path source passes through", () => {
      expect(transform('<%= image_tag asset_path("icon.png") %>')).toBe(
        '<img src="<%= asset_path("icon.png") %>" />'
      )
    })

    test("image_tag with image_url source passes through", () => {
      expect(transform('<%= image_tag image_url("icon.png") %>')).toBe(
        '<img src="<%= image_url("icon.png") %>" />'
      )
    })

    test("image_tag with asset_url source passes through", () => {
      expect(transform('<%= image_tag asset_url("icon.png") %>')).toBe(
        '<img src="<%= asset_url("icon.png") %>" />'
      )
    })

    test("image_tag with instance variable method wraps in image_path", () => {
      expect(transform('<%= image_tag @post.cover_image %>')).toBe(
        '<img src="<%= image_path(@post.cover_image) %>" />'
      )
    })

    test("image_tag with data attributes", () => {
      expect(transform('<%= image_tag "icon.png", data: { controller: "image" } %>')).toBe(
        '<img src="<%= image_path("icon.png") %>" data-controller="image" />'
      )
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
