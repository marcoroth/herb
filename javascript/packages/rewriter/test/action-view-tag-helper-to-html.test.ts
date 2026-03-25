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
        <div data-controller="content" data-user-id="123">
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

    test("tag.img with content argument reports parser error", () => {
      expect(() => transform('<%= tag.img "/image.png" %>')).toThrow(
        "Void element `img` cannot have content"
      )
    })

    test("tag.img with content argument and data attributes reports parser error", () => {
      expect(() => transform('<%= tag.img "/image.png", data: { controller: "image" } %>')).toThrow(
        "Void element `img` cannot have content"
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
        <div class="content" <%= tag.attributes(attributes) %>>
          Content
        </div>
      `

      expect(transform(input)).toBe(expected)
    })

    test("tag.h3 with variable content argument and attributes", () => {
      expect(transform('<%= tag.h3(title, class: "heading") %>')).toBe(
        '<h3 class="heading"><%= title %></h3>'
      )
    })

    test("tag.p with variable content argument and attributes without parens", () => {
      expect(transform('<%= tag.p message, class: "text" %>')).toBe(
        '<p class="text"><%= message %></p>'
      )
    })

    test("tag.div with render call as content argument and attributes", () => {
      expect(transform('<%= tag.div(render("icons/icon"), class: "icon") %>')).toBe(
        '<div class="icon"><%= render("icons/icon") %></div>'
      )
    })

    test("tag.span with instance variable content argument", () => {
      expect(transform('<%= tag.span @user.name, class: "name" %>')).toBe(
        '<span class="name"><%= @user.name %></span>'
      )
    })

    test("tag.h1 with method call content argument", () => {
      expect(transform('<%= tag.h1 t(".title"), class: "heading" %>')).toBe(
        '<h1 class="heading"><%= t(".title") %></h1>'
      )
    })

    test("tag.div with variable content argument only", () => {
      expect(transform('<%= tag.div content %>')).toBe(
        '<div><%= content %></div>'
      )
    })

    test("tag.h3 with postfix if condition", () => {
      expect(transform('<%= tag.h3(title, class: "heading") if title.present? %>')).toBe(
        '<% if title.present? %><h3 class="heading"><%= title %></h3><% end %>'
      )
    })

    test("tag.p with postfix unless condition", () => {
      expect(transform('<%= tag.p message, class: "text" unless hidden? %>')).toBe(
        '<% unless hidden? %><p class="text"><%= message %></p><% end %>'
      )
    })

    test("tag.div with postfix if condition and string content", () => {
      expect(transform('<%= tag.div "Content", class: "box" if show? %>')).toBe(
        '<% if show? %><div class="box">Content</div><% end %>'
      )
    })

    test("tag.span with postfix if condition and no attributes", () => {
      expect(transform('<%= tag.span @user.name if @user %>')).toBe(
        '<% if @user %><span><%= @user.name %></span><% end %>'
      )
    })

    test("tag.div with nested tag helpers and postfix conditions", () => {
      const input = dedent`
        <%= tag.div(class: wrapper_classes) do %>
          <%= tag.div(render("icons/\#{icon}"), class: icon_classes) if icon.present? %>

          <%= tag.div do %>
            <%= tag.h3(title, class: title_classes) if title.present? %>
            <%= tag.p(message, class: message_classes) %>
          <% end %>
        <% end %>
      `

      const expected = dedent`
        <div class="<%= wrapper_classes %>">
          <% if icon.present? %><div class="<%= icon_classes %>"><%= render("icons/\#{icon}") %></div><% end %>

          <div>
            <% if title.present? %><h3 class="<%= title_classes %>"><%= title %></h3><% end %>
            <p class="<%= message_classes %>"><%= message %></p>
          </div>
        </div>
      `

      expect(transform(input)).toBe(expected)
    })

    test("tag.script with nonce true passes through as literal", () => {
      expect(transform('<%= tag.script(nonce: true) { "alert(1)".html_safe } %>')).toBe(
        '<script nonce="true"><%= "alert(1)".html_safe %></script>'
      )
    })

    test("tag.script with nonce false passes through as literal", () => {
      expect(transform('<%= tag.script(nonce: false) { "alert(1)".html_safe } %>')).toBe(
        '<script nonce="false"><%= "alert(1)".html_safe %></script>'
      )
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

    test("content_tag :script with nonce true passes through as literal", () => {
      expect(transform('<%= content_tag(:script, "alert(1)", nonce: true) %>')).toBe(
        '<script nonce="true">alert(1)</script>'
      )
    })

    test("content_tag :script with nonce false passes through as literal", () => {
      expect(transform('<%= content_tag(:script, "alert(1)", nonce: false) %>')).toBe(
        '<script nonce="false">alert(1)</script>'
      )
    })

    test("content_tag with splat attributes", () => {
      const input = dedent`
        <%= content_tag(:div, **attributes) do %>
          Content
        <% end %>
      `

      const expected = dedent`
        <div <%= tag.attributes(attributes) %>>
          Content
        </div>
      `

      expect(transform(input)).toBe(expected)
    })

    test("content_tag with splat attributes in data", () => {
      const input = dedent`
        <%= content_tag(:div, data: { controller: "one", **attributes }) do %>
          Content
        <% end %>
      `

      const expected = dedent`
        <div data-controller="one" <%= tag.attributes(data: attributes) %>>
          Content
        </div>
      `

      expect(transform(input)).toBe(expected)
    })

    test("content_tag with splat attributes in aria", () => {
      const input = dedent`
        <%= content_tag(:div, aria: { label: "one", **attributes }) do %>
          Content
        <% end %>
      `

      const expected = dedent`
        <div aria-label="one" <%= tag.attributes(aria: attributes) %>>
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
        <turbo-frame id="tray" <%= tag.attributes(attributes) %>>
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

    test("javascript_tag with nonce true resolves to content_security_policy_nonce", () => {
      const input = dedent`
        <%= javascript_tag nonce: true do %>
          alert('Hello')
        <% end %>
      `

      const expected = dedent`
        <script nonce="<%= content_security_policy_nonce %>">
          alert('Hello')
        </script>
      `

      expect(transform(input)).toBe(expected)
    })

    test("javascript_tag with nonce false omits nonce attribute", () => {
      const input = dedent`
        <%= javascript_tag nonce: false do %>
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

    test("javascript_include_tag with nonce true resolves to content_security_policy_nonce", () => {
      expect(transform(`<%= javascript_include_tag "application", nonce: true %>`)).toBe(
        `<script src="<%= javascript_path("application") %>" nonce="<%= content_security_policy_nonce %>"></script>`
      )
    })

    test("javascript_include_tag with nonce false omits nonce attribute", () => {
      expect(transform(`<%= javascript_include_tag "application", nonce: false %>`)).toBe(
        `<script src="<%= javascript_path("application") %>"></script>`
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
        `<script src="http://www.example.com/xmlhr.js" nonce="<%= content_security_policy_nonce %>"></script>`
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

    test("image_tag with splat attributes", () => {
      expect(transform('<%= image_tag "icon.png", **attributes %>')).toBe(
        '<img src="<%= image_path("icon.png") %>" <%= tag.attributes(attributes) %> />'
      )
    })
  })

  describe("class attribute handling", () => {
    test("tag.div with conditional class hash wraps in token_list", () => {
      expect(transform('<%= tag.div class: { active: true, hidden: false } %>')).toBe(
        '<div class="<%= token_list({ active: true, hidden: false }) %>"></div>'
      )
    })

    test("tag.div with dynamic conditional class hash wraps in token_list", () => {
      expect(transform('<%= tag.div class: { active: @is_active } %>')).toBe(
        '<div class="<%= token_list({ active: @is_active }) %>"></div>'
      )
    })

    test("tag.div with mixed array class wraps in token_list", () => {
      expect(transform('<%= tag.div class: ["a", variable] %>')).toBe(
        '<div class="<%= token_list(["a", variable]) %>"></div>'
      )
    })

    test("tag.div with static string array class joins with spaces", () => {
      expect(transform('<%= tag.div class: ["kitties", "puppies"] %>')).toBe(
        '<div class="kitties puppies"></div>'
      )
    })

    test("tag.div with %w() class joins with spaces", () => {
      expect(transform('<%= tag.div class: %w( kitties puppies ) %>')).toBe(
        '<div class="kitties puppies"></div>'
      )
    })

    test("content_tag with mixed array and conditional hash class wraps in token_list", () => {
      expect(transform('<%= content_tag(:div, "Hello world!", class: ["strong", { highlight: current_user.admin? }]) %>')).toBe(
        '<div class="<%= token_list(["strong", { highlight: current_user.admin? }]) %>">Hello world!</div>'
      )
    })
  })

  describe("data attribute handling", () => {
    test("tag.div with integer data attribute inlines directly", () => {
      expect(transform('<%= tag.div data: { count: 42 } %>')).toBe(
        '<div data-count="42"></div>'
      )
    })

    test("tag.div with array data attribute wraps in .to_json", () => {
      expect(transform('<%= tag.div data: { items: ["a", "b"] } %>')).toBe(
        '<div data-items="<%= ["a", "b"].to_json %>"></div>'
      )
    })

    test("tag.div with nested hash data attribute wraps in .to_json", () => {
      expect(transform('<%= tag.div data: { config: { nested: "hash" } } %>')).toBe(
        '<div data-config="<%= { nested: "hash" }.to_json %>"></div>'
      )
    })
  })

  describe("tag.attributes", () => {
    test("tag.attributes extracts attributes into parent element", () => {
      expect(transform('<input <%= tag.attributes(type: :text, aria: { label: "Search" }) %>>')).toBe(
        '<input type="text" aria-label="Search">'
      )
    })

    test("tag.attributes with attributes after", () => {
      expect(transform('<button <%= tag.attributes(id: "cta", aria: { expanded: false }) %> class="primary">Click</button>')).toBe(
        '<button id="cta" aria-expanded="false" class="primary">Click</button>'
      )
    })

    test("tag.attributes with attributes before", () => {
      expect(transform('<button class="primary" <%= tag.attributes(id: "cta") %>>Click</button>')).toBe(
        '<button class="primary" id="cta">Click</button>'
      )
    })

    test("tag.attributes with data hash", () => {
      expect(transform('<div <%= tag.attributes(data: { controller: "hello" }) %>></div>')).toBe(
        '<div data-controller="hello"></div>'
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
