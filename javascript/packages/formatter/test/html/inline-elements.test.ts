import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Formatter } from "../../src"
import { createExpectFormattedToMatch } from "../helpers"

import dedent from "dedent"

let formatter: Formatter
let expectFormattedToMatch: ReturnType<typeof createExpectFormattedToMatch>

describe("@herb-tools/formatter - inline elements", () => {
  beforeAll(async () => {
    await Herb.load()

    formatter = new Formatter(Herb, {
      indentWidth: 2,
      maxLineLength: 80
    })

    expectFormattedToMatch = createExpectFormattedToMatch(formatter)
  })

  test("preserves inline elements in text flow (issue #251)", () => {
    expectFormattedToMatch(dedent`
      <p>Em<em>pha</em>sis</p>
    `)
  })

  test("preserves strong elements inline", () => {
    expectFormattedToMatch(dedent`
      <p>This is <strong>important</strong> text.</p>
    `)
  })

  test("preserves span elements inline", () => {
    expectFormattedToMatch(dedent`
      <div>Some <span>inline</span> content</div>
    `)
  })

  test("preserves links with attributes inline", () => {
    expectFormattedToMatch(dedent`
      <p>A <a href="/link">link</a> in text</p>
    `)
  })

  test("preserves multiple inline elements", () => {
    expectFormattedToMatch(dedent`
      <p>This has <em>emphasis</em> and <strong>strong</strong> text.</p>
    `)
  })

  test("preserves nested inline elements", () => {
    expectFormattedToMatch(dedent`
      <p>This is <strong>very <em>important</em></strong> text.</p>
    `)
  })

  test("preserves code elements inline", () => {
    expectFormattedToMatch(dedent`
      <p>Use the <code>foo()</code> function.</p>
    `)
  })

  test("preserves abbr elements inline", () => {
    const source = dedent`
      <p>The <abbr title="World Health Organization">WHO</abbr> was founded in 1948.</p>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <p>
        The <abbr title="World Health Organization">WHO</abbr> was founded in 1948.
      </p>
    `)
  })

  test("preserves del and ins elements inline", () => {
    expectFormattedToMatch(dedent`
      <p>The price is <del>$50</del> <ins>$40</ins>.</p>
    `)
  })

  test("correctly handles block elements in text flow", () => {
    const source = dedent`
      <div>Text before <div>block element</div> text after</div>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <div>
        Text before
        <div>block element</div>
        text after
      </div>
    `)
  })

  test("preserves inline elements with multiple attributes", () => {
    expectFormattedToMatch(dedent`
      <p>Visit <a href="/page" class="link" target="_blank">our page</a> today.</p>
    `)
  })

  test("preserves inline elements when content starts on same line", () => {
    expectFormattedToMatch(`<p>Em<em>pha</em>sis</p>`)
  })

  test("normalizes malformed closing tag placement", () => {
    const source = dedent`
      <p>
        Em<em>pha</em>sis</p>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <p>
        Em<em>pha</em>sis
      </p>
    `)
  })

  test("normalizes malformed closing tag placement", () => {
    const source = dedent`
      <p>
        Em<em>pha</em>sis
        </p>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <p>
        Em<em>pha</em>sis
      </p>
    `)
  })

  test("normalizes malformed closing tag placement", () => {
    const source = dedent`
      <p>
                  Test
        </p>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <p>
        Test
      </p>
    `)
  })

  test("normalizes malformed closing tag placement", () => {
    const source = dedent`
      <p>
                  Test
        </p>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <p>
        Test
      </p>
    `)
  })

  test("normalizes malformed closing tag placement", () => {
    const source = dedent`
      <p>
        Test</p>

    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <p>
        Test
      </p>
    `)
  })

  test("Element with ERB interpolation in text content", () => {
    expectFormattedToMatch(dedent`
      <h2 class="title">Posts (<%= @posts.count %>)</h2>
    `)
  })

  test("block element with ERB children on separate lines preserves format", () => {
    expectFormattedToMatch(dedent`
      <div class="form-inputs">
        <%= f.input :password, hint: false %>
        <%= f.input :password_confirmation %>
      </div>
    `)
  })

  test("adjacent ERB tags on same line as block element expand to multiline", () => {
    const source = dedent`
      <div class="form-inputs"><%= f.input :password, hint: false %><%= f.input :password_confirmation %></div>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <div class="form-inputs">
        <%= f.input :password, hint: false %><%= f.input :password_confirmation %>
      </div>
    `)
  })

  test("spaced ERB tags on same line as block element expand to multiline", () => {
    const source = dedent`
      <div class="form-inputs"><%= f.input :password, hint: false %> <%= f.input :password_confirmation %></div>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <div class="form-inputs">
        <%= f.input :password, hint: false %> <%= f.input :password_confirmation %>
      </div>
    `)
  })

  test("preserves ERB interpolation in attributes", () => {
    expectFormattedToMatch(dedent`
      <div class="<%= some_var %> style="<%= some_other_var" %>"></div>
    `)
  })
})
