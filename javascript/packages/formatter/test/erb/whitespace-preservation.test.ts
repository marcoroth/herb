import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Formatter } from "../../src"
import { createExpectFormattedToMatch } from "../helpers"

import dedent from "dedent"

let formatter: Formatter
let expectFormattedToMatch: ReturnType<typeof createExpectFormattedToMatch>

describe("whitespace preservation around ERB control flow", () => {
  beforeAll(async () => {
    await Herb.load()

    formatter = new Formatter(Herb, { indentWidth: 2, maxLineLength: 80 })
    expectFormattedToMatch = createExpectFormattedToMatch(formatter)
  })

  describe("#1729 — text glued across a control-flow boundary", () => {
    test("keeps text glued on both sides of an if inside a block element", () => {
      const source = `<p>Hello<% if owner %> <%= owner.name %>'s dog<% end %>!</p>`

      const expected = dedent`
        <p>
          Hello<% if owner %> <%= owner.name %>'s dog<% end %>!
        </p>
      `

      expect(formatter.format(source)).toEqual(expected)
      expectFormattedToMatch(expected)
    })

    test("keeps text glued inside a div", () => {
      const source = `<div>Hello<% if owner %> <%= owner.name %>'s dog<% end %>!</div>`

      const expected = dedent`
        <div>
          Hello<% if owner %> <%= owner.name %>'s dog<% end %>!
        </div>
      `

      expect(formatter.format(source)).toEqual(expected)
      expectFormattedToMatch(expected)
    })

    test("leaves an already-inline document-root fragment untouched", () => {
      expectFormattedToMatch(`Hello<% if owner %> <%= owner.name %>'s dog<% end %>!`)
    })

    test("keeps glue when only the opening tag is glued", () => {
      const source = `<p>Hello<% if x %> a <% end %></p>`

      const expected = dedent`
        <p>
          Hello<% if x %> a <% end %>
        </p>
      `

      expect(formatter.format(source)).toEqual(expected)
      expectFormattedToMatch(expected)
    })

    test("keeps glue when only the closing tag is glued", () => {
      const source = `<p><% if x %>a<% end %>!</p>`

      const expected = dedent`
        <p>
          <% if x %>a<% end %>!
        </p>
      `

      expect(formatter.format(source)).toEqual(expected)
      expectFormattedToMatch(expected)
    })

    test("keeps glue on both sides with no inner whitespace", () => {
      const source = `<p>E<% if x %>xy<% end %>!</p>`

      const expected = dedent`
        <p>
          E<% if x %>xy<% end %>!
        </p>
      `

      expect(formatter.format(source)).toEqual(expected)
      expectFormattedToMatch(expected)
    })

    test("overflowing glued content stays on one line rather than breaking", () => {
      const source = `<p>Hello<% if owner %> <%= owner.name %>'s extremely long dog name here that overflows<% end %>!</p>`

      const expected = dedent`
        <p>
          Hello<% if owner %> <%= owner.name %>'s extremely long dog name here that overflows<% end %>!
        </p>
      `

      expect(formatter.format(source)).toEqual(expected)
      expectFormattedToMatch(expected)
    })
  })

  describe("control-flow keywords other than if", () => {
    test("unless", () => {
      const expected = dedent`
        <p>
          A<% unless x %>b<% end %>!
        </p>
      `

      expect(formatter.format(`<p>A<% unless x %>b<% end %>!</p>`)).toEqual(expected)
      expectFormattedToMatch(expected)
    })

    test("case/when", () => {
      const expected = dedent`
        <p>
          A<% case x %><% when 1 %>one<% end %>!
        </p>
      `

      expect(formatter.format(`<p>A<% case x %><% when 1 %>one<% end %>!</p>`)).toEqual(expected)
      expectFormattedToMatch(expected)
    })

    test("nested control flow", () => {
      const expected = dedent`
        <p>
          A<% if x %><% if y %>b<% end %><% end %>!
        </p>
      `

      expect(formatter.format(`<p>A<% if x %><% if y %>b<% end %><% end %>!</p>`)).toEqual(expected)
      expectFormattedToMatch(expected)
    })

    test("while loop keeps a glued trailing statement attached", () => {
      const source = `<% while i < 3 %><b><%= i %></b><% i += 1 %><% end %>`

      const expected = dedent`
        <% while i < 3 %>
          <b><%= i %></b><% i += 1 %>
        <% end %>
      `

      expect(formatter.format(source)).toEqual(expected)
      expectFormattedToMatch(expected)
    })
  })

  describe("whitespace-separated control flow is still laid out as a block", () => {
    test("spaces on both sides means breaking is safe", () => {
      const source = `<p>Hello <% if x %>a<% end %> there</p>`

      const expected = dedent`
        <p>
          Hello
          <% if x %>
            a
          <% end %>
          there
        </p>
      `

      expect(formatter.format(source)).toEqual(expected)
      expectFormattedToMatch(expected)
    })

    test("free-standing control flow keeps its block layout", () => {
      expectFormattedToMatch(dedent`
        <div>
          <% if x %>
            <p>a</p>
          <% end %>
        </div>
      `)
    })
  })

  describe("falls back to block layout when the node cannot be inlined", () => {
    test("block element inside glued control flow", () => {
      const source = `<p>A<% if x %><div>b</div><% end %>!</p>`

      const expected = dedent`
        <p>
          A
          <% if x %>
            <div>b</div>
          <% end %>
          !
        </p>
      `

      expect(formatter.format(source)).toEqual(expected)
      expectFormattedToMatch(expected)
    })
  })

  describe("#469 / #1729 (comment) — output glued to punctuation and <br>", () => {
    test("at the document root the comma stays glued to the <br>", () => {
      expectFormattedToMatch(dedent`
        <%= @user.preferred_greeting %>,<br>
        <br>
        <p>blah blah</p>
      `)
    })

    test("inside an if the comma stays glued to the <br>", () => {
      expectFormattedToMatch(dedent`
        <% if something? %>
          <%= @user.preferred_greeting %>,<br>
          <br>
          <p>blah blah</p>
        <% end %>
      `)
    })

    test("inside a capture block the comma stays glued to the <br>", () => {
      expectFormattedToMatch(dedent`
        <% capture do %>
          <%= @user.preferred_greeting %>,<br>
          <br>
          <p>blah blah</p>
        <% end %>
      `)
    })
  })

  describe("#1883 — whitespace between children of an inline element", () => {
    test("keeps the space between two inline elements", () => {
      const source = dedent`
        <div><span>
          <em>a</em>
          <em>b</em>
        </span></div>
      `

      const expected = `<div><span><em>a</em> <em>b</em></span></div>`

      expect(formatter.format(source)).toEqual(expected)
      expectFormattedToMatch(expected)
    })

    test("keeps the space between two ERB outputs", () => {
      const source = dedent`
        <div><label>
          <%= a %>
          <%= b %>
        </label></div>
      `

      const expected = `<div><label><%= a %> <%= b %></label></div>`

      expect(formatter.format(source)).toEqual(expected)
      expectFormattedToMatch(expected)
    })

    test("keeps the space between text and an inline element", () => {
      const source = dedent`
        <div><span>
          text
          <em>x</em>
        </span></div>
      `

      const expected = `<div><span>text <em>x</em></span></div>`

      expect(formatter.format(source)).toEqual(expected)
      expectFormattedToMatch(expected)
    })
  })

  describe("#1883 — whitespace at the edges of an inline element", () => {
    test("keeps edge whitespace when the element has inline neighbours", () => {
      expectFormattedToMatch(`<p>x<span> <em>y</em> </span>z</p>`)
    })

    test("keeps a leading space before an inline child", () => {
      expectFormattedToMatch(`<p>D<span> <em>x</em>'s dog</span>!</p>`)
    })

    test("keeps a leading space after an adjacent inline element", () => {
      expectFormattedToMatch(`<div><a href="/x">one</a><span> <em>two</em></span></div>`)
    })

    test("keeps a leading space before ERB control flow", () => {
      expectFormattedToMatch(`<span>Hello<% if owner %> <%= owner.name %>'s dog<% end %>!</span>`)
    })

    test("inherits edge context through an inline ancestor", () => {
      expectFormattedToMatch(`<p>x<em><span> y </span></em>z</p>`)
    })

    test("drops edge whitespace at a block boundary, where it would collapse anyway", () => {
      const expected = `<div><span><em>x</em></span></div>`

      expect(formatter.format(`<div><span> <em>x</em> </span></div>`)).toEqual(expected)
      expectFormattedToMatch(expected)
    })

    test("drops a redundant inner space when the outside already separates", () => {
      const expected = `<p>text <span><em>x</em></span></p>`

      expect(formatter.format(`<p>text <span> <em>x</em></span></p>`)).toEqual(expected)
      expectFormattedToMatch(expected)
    })
  })

  describe("space-separated punctuation keeps its space", () => {
    test("colon in a control-flow body", () => {
      const expected = dedent`
        <p>
          <% if x %>
            Label <%= a %> : value
          <% end %>
        </p>
      `

      expect(formatter.format(`<p><% if x %>Label <%= a %> : value<% end %></p>`)).toEqual(expected)
      expectFormattedToMatch(expected)
    })

    test("question mark in a control-flow body", () => {
      const expected = dedent`
        <p>
          <% if x %>
            Ready <%= a %> ? yes
          <% end %>
        </p>
      `

      expect(formatter.format(`<p><% if x %>Ready <%= a %> ? yes<% end %></p>`)).toEqual(expected)
      expectFormattedToMatch(expected)
    })

    test("ruby ternary survives intact", () => {
      const source = dedent`
        <% if x %>
          <%= f %>: this.<%= f %> ? this.<%= f %>.toJSON() : null,
        <% end %>
      `

      expectFormattedToMatch(source)
    })

    test("punctuation glued in the source stays glued", () => {
      const expected = dedent`
        <p>
          <% if x %>
            Label <%= a %>: value
          <% end %>
        </p>
      `

      expect(formatter.format(`<p><% if x %>Label <%= a %>: value<% end %></p>`)).toEqual(expected)
      expectFormattedToMatch(expected)
    })

  })

  // https://github.com/marcoroth/herb/issues/1721
  describe("#1721 — inline elements inside a control-flow body", () => {
    test("keeps trailing punctuation attached to a closing tag", () => {
      expectFormattedToMatch(dedent`
        <% if condition %>
          Created at <a href="<%= url %>">Acme</a>.
        <% end %>
      `)
    })

    test("keeps text following a closing tag on the same line", () => {
      expectFormattedToMatch(dedent`
        <% if condition %>
          <em>name</em> created an account.
        <% end %>
      `)
    })

    test("keeps the run intact inside a block body", () => {
      expectFormattedToMatch(dedent`
        <% items.each do |item| %>
          Created at <a href="<%= item %>">Acme</a>.
        <% end %>
      `)
    })

    test("keeps the run intact inside an unless body", () => {
      expectFormattedToMatch(dedent`
        <% unless condition %>
          Created at <a href="<%= url %>">Acme</a>.
        <% end %>
      `)
    })

    test("behaves the same outside a control-flow body", () => {
      expectFormattedToMatch(`<p>You are at <a href="/">Acme</a>.</p>`)
      expectFormattedToMatch(`<p><em><%= name %></em> created an account.</p>`)
    })
  })

  // https://github.com/marcoroth/herb/issues/1922
  describe("#1922 — space before an output tag preceded by a sibling node", () => {
    test("keeps the space when a control-flow node precedes the line", () => {
      expectFormattedToMatch(dedent`
        <% if @show_x %>
          x
        <% end %>
        y and <%= @z %>
      `)
    })

    test("keeps the space when an HTML element precedes the line", () => {
      expectFormattedToMatch(dedent`
        <div>x</div>
        y and <%= @z %>
      `)
    })

    test("keeps the space when an output tag precedes the line", () => {
      expect(formatter.format(dedent`
        <%= @x %>
        y and <%= @z %>
      `)).toEqual(`<%= @x %> y and <%= @z %>`)
    })

    test("keeps the space inside a block element", () => {
      expectFormattedToMatch(dedent`
        <section>
          <div>x</div>
          y and <%= @z %>
        </section>
      `)
    })

    test("keeps text glued to the output tag when the source has no space", () => {
      expectFormattedToMatch(dedent`
        <div>x</div>
        y and<%= @z %>
      `)
    })

    test("keeps the space with no preceding sibling", () => {
      expectFormattedToMatch(`y and <%= @z %>`)
    })
  })
})
