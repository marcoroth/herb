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

  test("block element with single ERB child on separate line preserves format (issue #1181)", () => {
    expectFormattedToMatch(dedent`
      <div class="form-inputs">
        <%= f.input :password, hint: false %>
      </div>
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

  test("spaced ERB tags on separate line from block element preserves format", () => {
    expectFormattedToMatch(dedent`
      <div class="form-inputs">
        <%= f.input :password, hint: false %> <%= f.input :password_confirmation %>
      </div>
    `)
  })

  test("preserves content of element with whitespace-pre-line class (issue #1095)", () => {
    expectFormattedToMatch(dedent`
      <div>
        <div>
          <div>
            <div>
              <div>
                <span class="truncate whitespace-pre-line"><%= option[:value] %></span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `)
  })

  test("preserves content of element with whitespace-pre-line class and multiline body (issue #1095)", () => {
    expectFormattedToMatch(dedent`
      <div>
        <div>
          <div>
            <div>
              <div>
                <span class="truncate whitespace-pre-line">
                  <%= option[:value] %>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `)
  })

  test("preserves content of element with whitespace-pre class", () => {
    expectFormattedToMatch(`<span class="whitespace-pre">  some   spaced   text  </span>`)
  })

  test("preserves content of element with whitespace-pre-wrap class", () => {
    expectFormattedToMatch(`<span class="whitespace-pre-wrap">  some   spaced   text  </span>`)
  })

  test("preserves content of element with whitespace-break-spaces class", () => {
    expectFormattedToMatch(`<span class="whitespace-break-spaces">  some   spaced   text  </span>`)
  })

  test("preserves content of element with inline style white-space: pre", () => {
    expectFormattedToMatch(`<span style="white-space: pre">  some   spaced   text  </span>`)
  })

  test("preserves content of element with inline style white-space: pre-line", () => {
    expectFormattedToMatch(`<span style="white-space: pre-line">  some   spaced   text  </span>`)
  })

  test("preserves content of element with inline style white-space:pre (no space)", () => {
    expectFormattedToMatch(`<span style="white-space:pre">  some   spaced   text  </span>`)
  })

  test("does not treat whitespace-normal class as content preserving", () => {
    expectFormattedToMatch(`<span class="whitespace-normal">some text</span>`)
  })

  test("does not treat whitespace-nowrap class as content preserving", () => {
    expectFormattedToMatch(`<span class="whitespace-nowrap">some text</span>`)
  })

  test("does not treat inline style white-space: normal as content preserving", () => {
    expectFormattedToMatch(`<span style="white-space: normal">some text</span>`)
  })

  test("does not treat inline style white-space: nowrap as content preserving", () => {
    expectFormattedToMatch(`<span style="white-space: nowrap">some text</span>`)
  })

  test("preserves content with Tailwind responsive prefix md:whitespace-pre-line", () => {
    expectFormattedToMatch(`<span class="md:whitespace-pre-line">  some   spaced   text  </span>`)
  })

  test("preserves content with Tailwind state prefix hover:whitespace-pre", () => {
    expectFormattedToMatch(`<span class="hover:whitespace-pre">  some   spaced   text  </span>`)
  })

  test("preserves content with chained Tailwind prefix lg:hover:whitespace-pre-wrap", () => {
    expectFormattedToMatch(`<span class="lg:hover:whitespace-pre-wrap">  some   spaced   text  </span>`)
  })

  test("preserves content with inline style white-space: pre !important", () => {
    expectFormattedToMatch(`<span style="white-space: pre !important">  some   spaced   text  </span>`)
  })

  test("preserves content with white-space among other style properties", () => {
    expectFormattedToMatch(`<span style="color: red; white-space: pre-wrap; font-size: 12px">  some   spaced   text  </span>`)
  })

  test("preserves content of block element with whitespace-preserving class", () => {
    expectFormattedToMatch(dedent`
      <div class="whitespace-pre">  some   spaced
        text  with
        newlines  </div>
    `)
  })

  test("preserves content when whitespace-preserving class is among many classes", () => {
    expectFormattedToMatch(`<span class="flex items-center whitespace-pre-line text-sm truncate">  some   spaced   text  </span>`)
  })

  test("preserves nested elements inside whitespace-preserving parent", () => {
    expectFormattedToMatch(dedent`
      <div class="whitespace-pre-line">
        <span>  some   text  </span>
        <strong>  more   text  </strong>
      </div>
    `)
  })

  test("preserves content with white-space as last style property without trailing semicolon", () => {
    expectFormattedToMatch(`<span style="color: red; white-space: pre">  some   spaced   text  </span>`)
    expectFormattedToMatch(`<span style="color: red; white-space: pre;">  some   spaced   text  </span>`)
    expectFormattedToMatch(`<span style="white-space: pre; color: red; ">  some   spaced   text  </span>`)
  })

  test("preserves ERB interpolation in attributes", () => {
    expectFormattedToMatch(dedent`
      <div class="<%= some_var %> style="<%= some_other_var" %>"></div>
    `)
  })
})
