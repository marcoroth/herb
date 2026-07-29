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

      expect(formatter.format(source)).toEqual(dedent`
        <p>
          Hello<% if x %> a <% end %>
        </p>
      `)
    })

    test("keeps glue when only the closing tag is glued", () => {
      const source = `<p><% if x %>a<% end %>!</p>`

      expect(formatter.format(source)).toEqual(dedent`
        <p>
          <% if x %>a<% end %>!
        </p>
      `)
    })

    test("keeps glue on both sides with no inner whitespace", () => {
      const source = `<p>E<% if x %>xy<% end %>!</p>`

      expect(formatter.format(source)).toEqual(dedent`
        <p>
          E<% if x %>xy<% end %>!
        </p>
      `)
    })

    test("overflowing glued content stays on one line rather than breaking", () => {
      const source = `<p>Hello<% if owner %> <%= owner.name %>'s extremely long dog name here that overflows<% end %>!</p>`

      expect(formatter.format(source)).toEqual(dedent`
        <p>
          Hello<% if owner %> <%= owner.name %>'s extremely long dog name here that overflows<% end %>!
        </p>
      `)
    })
  })

  describe("control-flow keywords other than if", () => {
    test("unless", () => {
      expect(formatter.format(`<p>A<% unless x %>b<% end %>!</p>`)).toEqual(dedent`
        <p>
          A<% unless x %>b<% end %>!
        </p>
      `)
    })

    test("case/when", () => {
      expect(formatter.format(`<p>A<% case x %><% when 1 %>one<% end %>!</p>`)).toEqual(dedent`
        <p>
          A<% case x %><% when 1 %>one<% end %>!
        </p>
      `)
    })

    test("nested control flow", () => {
      expect(formatter.format(`<p>A<% if x %><% if y %>b<% end %><% end %>!</p>`)).toEqual(dedent`
        <p>
          A<% if x %><% if y %>b<% end %><% end %>!
        </p>
      `)
    })

    test("while loop keeps a glued trailing statement attached", () => {
      const source = `<% while i < 3 %><b><%= i %></b><% i += 1 %><% end %>`

      expect(formatter.format(source)).toEqual(dedent`
        <% while i < 3 %>
          <b><%= i %></b><% i += 1 %>
        <% end %>
      `)
    })
  })

  describe("whitespace-separated control flow is still laid out as a block", () => {
    test("spaces on both sides means breaking is safe", () => {
      const source = `<p>Hello <% if x %>a<% end %> there</p>`

      expect(formatter.format(source)).toEqual(dedent`
        <p>
          Hello
          <% if x %>
            a
          <% end %>
          there
        </p>
      `)
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

      expect(formatter.format(source)).toEqual(dedent`
        <p>
          A
          <% if x %>
            <div>b</div>
          <% end %>
          !
        </p>
      `)
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

      expect(formatter.format(source)).toEqual(`<div><span><em>a</em> <em>b</em></span></div>`)
    })

    test("keeps the space between two ERB outputs", () => {
      const source = dedent`
        <div><label>
          <%= a %>
          <%= b %>
        </label></div>
      `

      expect(formatter.format(source)).toEqual(`<div><label><%= a %> <%= b %></label></div>`)
    })

    test("keeps the space between text and an inline element", () => {
      const source = dedent`
        <div><span>
          text
          <em>x</em>
        </span></div>
      `

      expect(formatter.format(source)).toEqual(`<div><span>text <em>x</em></span></div>`)
    })
  })

  describe("known gaps", () => {
    test.fails("inline container keeps a leading space before an inline child", () => {
      expectFormattedToMatch(`<p>D<span> <em>x</em>'s dog</span>!</p>`)
    })

    test.fails("inline container keeps a leading space before ERB control flow", () => {
      expectFormattedToMatch(`<span>Hello<% if owner %> <%= owner.name %>'s dog<% end %>!</span>`)
    })
  })
})
