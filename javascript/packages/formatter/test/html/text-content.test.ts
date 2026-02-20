import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Formatter } from "../../src"
import { createExpectFormattedToMatch } from "../helpers"

import dedent from "dedent"

let formatter: Formatter
let expectFormattedToMatch: ReturnType<typeof createExpectFormattedToMatch>

describe("@herb-tools/formatter", () => {
  beforeAll(async () => {
    await Herb.load()

    formatter = new Formatter(Herb, {
      indentWidth: 2,
      maxLineLength: 80
    })

    expectFormattedToMatch = createExpectFormattedToMatch(formatter)
  })

  test("text content", () => {
    const source = dedent`
      Hello
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      Hello
    `)
  })

  test("text content inside element", () => {
    const source = dedent`
      <div>Hello</div>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <div>Hello</div>
    `)
  })

  test("short text content stays inline", () => {
    const source = dedent`
      <h1>hello</h1>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <h1>hello</h1>
    `)
  })

  test("long text content splits across lines", () => {
    const source = dedent`
      <h1>This is a very long text that should probably be split across multiple lines because it exceeds the max line length</h1>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <h1>
        This is a very long text that should probably be split across multiple lines
        because it exceeds the max line length
      </h1>
    `)
  })

  test("multiline text content splits across lines", () => {
    const source = dedent`
      <div>Multi
      line</div>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <div>
        Multi line
      </div>
    `)
  })

  test("mixed inline content stays inline", () => {
    const source = dedent`
      <p>hello <b>bold</b> world</p>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <p>hello <b>bold</b> world</p>
    `)
  })

  test("simple mixed content with multiple elements stays inline", () => {
    const source = dedent`
      <p>A <b>bold</b> and <i>italic</i> text</p>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <p>A <b>bold</b> and <i>italic</i> text</p>
    `)
  })

  test("any tag can be inline when content is simple", () => {
    const source = dedent`
      <div>Simple <section>nested</section> content</div>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <div>
        Simple
        <section>nested</section>
        content
      </div>
    `)
  })

  test("mixed content with nested elements splits when too deep", () => {
    const source = dedent`
      <p>hello <div>complex <span>nested</span> content</div> world</p>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <p>
        hello
        <div>complex <span>nested</span> content</div>
        world
      </p>
    `)
  })

  test("single level nesting stays inline", () => {
    const source = dedent`
      <h1><b>hello</b></h1>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <h1><b>hello</b></h1>
    `)
  })

  test("deep nesting with inline elements keeps inner elements inline", () => {
    const source = dedent`
      <h1><b><i>hello</i></b></h1>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <h1><b><i>hello</i></b></h1>
    `)
  })

  test("Block element nested inside inline context", () => {
    const source = dedent`
      <h1><div><b>hello</b></div></h1>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <h1>
        <div><b>hello</b></div>
      </h1>
    `)
  })

  test("root-level text with ERB interpolation", () => {
    expectFormattedToMatch(dedent`
      Hello, <%= @name %>, it is <%= @time %>.
    `)
  })

  test("text with ERB interpolation inside element", () => {
    expectFormattedToMatch(dedent`
      <div>Hello, <%= @name %>, it is <%= @time %>.</div>
    `)
  })

  test("period after ERB tag", () => {
    expectFormattedToMatch(dedent`
      Today is <%= Date.current %>.
    `)
  })

  test("exclamation mark after ERB tag", () => {
    expectFormattedToMatch(dedent`
      Welcome <%= @user.name %>!
    `)
  })

  test("question mark after ERB tag", () => {
    expectFormattedToMatch(dedent`
      Is this <%= @status %>?
    `)
  })

  test("semicolon after ERB tag", () => {
    expectFormattedToMatch(dedent`
      First item: <%= @item %>;
    `)
  })

  test("comma should not merge - maintains space", () => {
    expectFormattedToMatch(dedent`
      Hello <%= @first %>, how are you?
    `)
  })

  test("colon after ERB with newline with <br>", () => {
    const input = dedent`
      <p>
      <br>
      <%= Date.current %>: Hello
      </p>
    `

    const expected = dedent`
      <p>
        <br>
        <%= Date.current %>: Hello
      </p>
    `

    const result = formatter.format(input)
    expect(result).toEqual(expected)
  })

  test("colon after ERB with newline with <hr>", () => {
    const input = dedent`
      <p>
      <hr>
      <%= Date.current %>: Hello
      </p>
    `

    const expected = dedent`
      <p>
        <hr>
        <%= Date.current %>: Hello
      </p>
    `

    const result = formatter.format(input)
    expect(result).toEqual(expected)
  })

  test("colon after ERB with newline (after <br>)", () => {
    const result = formatter.format(dedent`
      <html>
      <head></head>
      <body>
      <div class="main">
      <p>
      <strong>Bold Heading:</strong><br>
      <%= Date.current %>: Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore
      magna aliqua.
      </p>
      </div>
      </body>
      </html>
    `)

    expect(result).toEqual(dedent`
      <html>
        <head></head>

        <body>
          <div class="main">
            <p>
              <strong>Bold Heading:</strong><br>
              <%= Date.current %>: Lorem ipsum dolor sit amet, consectetur adipiscing
              elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
            </p>
          </div>
        </body>
      </html>
    `)
  })

  test("multiple inline elements with punctuation preserve spacing", () => {
    const result = formatter.format(dedent`
      <p>Visit <a href="/store">our store</a>; buy <strong>great products</strong>!</p>
    `)

    expect(result).toEqual(dedent`
      <p>
        Visit <a href="/store">our store</a>; buy <strong>great products</strong>!
      </p>
    `)
  })

  test("inline element at line end with punctuation on next line", () => {
    const result = formatter.format(dedent`
      <div>
        Check <em>this</em>
        : it works!
      </div>
    `)

    expect(result).toEqual(dedent`
      <div>Check <em>this</em> : it works!</div>
    `)
  })

  test("ERB between inline elements with trailing punctuation", () => {
    const result = formatter.format(dedent`
      <p>Hello <strong>world</strong> <%= @greeting %>!</p>
    `)

    expect(result).toEqual(dedent`
      <p>Hello <strong>world</strong> <%= @greeting %>!</p>
    `)
  })

  test("semicolon after inline element in long text", () => {
    const result = formatter.format(dedent`
      <div>Download <a href="/app">the app</a>; install quickly; then restart your <strong>device</strong>.</div>
    `)

    expect(result).toEqual(dedent`
      <div>
        Download <a href="/app">the app</a>; install quickly; then restart your
        <strong>device</strong>.
      </div>
    `)
  })

  test("exclamation after ERB following inline element", () => {
    const result = formatter.format(dedent`
      <p>See <strong>bold text</strong> <%= @value %>!</p>
    `)

    expect(result).toEqual(dedent`
      <p>See <strong>bold text</strong> <%= @value %>!</p>
    `)
  })

  test("question mark after nested inline elements", () => {
    const result = formatter.format(dedent`
      <div>Is <strong><em>this</em></strong> correct?</div>
    `)

    expect(result).toEqual(dedent`
      <div>Is <strong><em>this</em></strong> correct?</div>
    `)
  })

  test("long text with strong and em in between", () => {
    const result = formatter.format(dedent`
      <div>This is a super long text before the strong and em element to check if <strong><em>this</em></strong> works, even if there's a long text after the strong and em element!</div>
    `)

    expect(result).toEqual(dedent`
      <div>
        This is a super long text before the strong and em element to check if
        <strong><em>this</em></strong> works, even if there's a long text after the
        strong and em element!
      </div>
    `)
  })

  test("ERB block with non-output tag followed by text without space", () => {
    expectFormattedToMatch(dedent`
      <%= link_to "/" do %>
        <% icon("icon") %>can not insert whitespace here
      <% end %>
    `)
  })

  test("text with hyphen before inline bold element preserves no-space boundary", () => {
    const source = dedent`
      <div>
        This is a div where we still can assume that whitespace can be inserted-<b>infront or after of this bold you can not insert whitespace</b>. Next senctence.
      </div>
    `

    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <div>
        This is a div where we still can assume that whitespace can be
        inserted-<b>infront or after of this bold you can not insert whitespace</b>.
        Next senctence.
      </div>
    `)
  })

  // TODO: we need to wait for the parser to transform this as a HTMLElementNode
  test("ERB block tag with inline content should stay on one line", () => {
    const source = dedent`
      <%= tag.span do %>This should stay on one line<% end %>
    `

    const result = formatter.format(source)
    // TODO: expect(result).toEqual(source)

    expect(result).toEqual(dedent`
      <%= tag.span do %>
        This should stay on one line
      <% end %>
    `)
  })

  test("multiline span with text collapses to inline with spaces", () => {
    const source = dedent`
      <span>
        And on the other hand one can not remove whitespace entirely
      </span>
    `

    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <span> And on the other hand one can not remove whitespace entirely </span>
    `)
  })

  test("inline span with text content on single line preserves format", () => {
    expectFormattedToMatch(dedent`
      <span>And on the other hand one can not remove whitespace entirely</span>
    `)
  })

  test("inline span with leading and trailing spaces preserves them", () => {
    expectFormattedToMatch(dedent`
      <span> And on the other hand one can not remove whitespace entirely </span>
    `)
  })

  test("div with multiline text preserves leading and trailing whitespace", () => {
    expectFormattedToMatch(dedent`
      <div>
        Here the whitespace will not be removed
      </div>
    `)
  })

  test("div with inline text content preserves format", () => {
    expectFormattedToMatch(dedent`
      <div>Here the whitespace will not be removed</div>
    `)
  })

  test("div with leading and trailing spaces trims them for inline content", () => {
    const source = dedent`
      <div> Here the whitespace will not be removed </div>
    `

    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <div>Here the whitespace will not be removed</div>
    `)
  })

  test("inline bold with ERB collapses when alone but preserves when adjacent", () => {
    const source = dedent`
      <p>
        <b><%= a_thing %> <%= another_thing %></b>
      </p>

      <p>
        <b><%= a_thing %> <%= another_thing %></b>a
      </p>

      <p>
        <b><%= a_thing %> <%= another_thing %></b>
        <b><%= a_thing %> <%= another_thing %></b>a
      </p>
    `

    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <p><b><%= a_thing %> <%= another_thing %></b></p>

      <p><b><%= a_thing %> <%= another_thing %></b>a</p>

      <p>
        <b><%= a_thing %> <%= another_thing %></b>
        <b><%= a_thing %> <%= another_thing %></b>a
      </p>
    `)
  })
})
