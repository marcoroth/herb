import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Formatter } from "../../src"

import dedent from "dedent"

let formatter: Formatter

describe("Unicode character handling", () => {
  beforeAll(async () => {
    await Herb.load()

    formatter = new Formatter(Herb, {
      indentWidth: 2,
      maxLineLength: 80
    })
  })

  test("Issue #360: Em dash and curly apostrophe should not corrupt comments", () => {
    const source = dedent`
      <div>
        <p>
        Discover what our team and community are highlighting right now — the
        best talks, tools, and insights we’re curating for developers
        </p>
      </div>

      <!-- HTML comment -->
      <%# ERB comment %>
    `

    const result = formatter.format(source)

    expect(result).toBe(dedent`
      <div>
        <p>
          Discover what our team and community are highlighting right now — the best
          talks, tools, and insights we’re curating for developers
        </p>
      </div>

      <!-- HTML comment -->

      <%# ERB comment %>
    `)
  })

  test("Em dash alone should not corrupt comments", () => {
    const source = dedent`
      <p>This contains an em dash — here</p>
      <!-- HTML comment -->
    `

    const result = formatter.format(source)

    expect(result).toBe(dedent`
      <p>This contains an em dash — here</p>

      <!-- HTML comment -->
    `)
  })

  test("Curly apostrophe alone should not corrupt comments", () => {
    const source = dedent`
      <p>This contains a curly apostrophe: we’re testing</p>
      <!-- HTML comment -->
    `

    const result = formatter.format(source)

    expect(result).toBe(dedent`
      <p>This contains a curly apostrophe: we’re testing</p>

      <!-- HTML comment -->
    `)
  })

  test("Multiple Unicode punctuation characters", () => {
    const source = dedent`
      <div>
        <p>Testing various Unicode: em dash — en dash – curly apostrophe ’hello’</p>
      </div>
      <!-- HTML comment -->
      <%# ERB comment %>
    `

    const result = formatter.format(source)

    expect(result).toBe(dedent`
      <div>
        <p>Testing various Unicode: em dash — en dash – curly apostrophe ’hello’</p>
      </div>

      <!-- HTML comment -->

      <%# ERB comment %>
    `)
  })

  test("Unicode characters in attributes", () => {
    const source = dedent`
      <div title="Testing — em dash and 'quotes'" data-content="More – unicode">
        Content
      </div>
      <!-- Comment -->
    `

    const result = formatter.format(source)

    expect(result).toBe(dedent`
      <div title="Testing — em dash and 'quotes'" data-content="More – unicode">
        Content
      </div>

      <!-- Comment -->
    `)
  })

  test("Unicode characters with ERB tags", () => {
    const source = dedent`
      <p>
        <%= "Text with — dash" %> and 'quotes'
      </p>
      <%# ERB comment %>
    `

    const result = formatter.format(source)

    expect(result).toBe(dedent`
      <p><%= "Text with — dash" %> and 'quotes'</p>

      <%# ERB comment %>
    `)
  })

  test("Complex nested structure with Unicode", () => {
    const source = dedent`
      <article>
        <header>
          <h1>Article — Title with 'quotes'</h1>
        </header>
        <div class="content">
          <p>
            First paragraph with — em dash and ’curly quotes’
          </p>
          <p>
            Second paragraph with – en dash
          </p>
        </div>
      </article>

      <!-- HTML comment here -->
      <%# ERB comment here %>
    `

    const result = formatter.format(source)

    expect(result).toBe(dedent`
      <article>
        <header>
          <h1>Article — Title with 'quotes'</h1>
        </header>
        <div class="content">
          <p>
            First paragraph with — em dash and ’curly quotes’
          </p>
          <p>
            Second paragraph with – en dash
          </p>
        </div>
      </article>

      <!-- HTML comment here -->

      <%# ERB comment here %>
    `)
  })

  test("Unicode in comment content itself", () => {
    const source = dedent`
      <div>Content</div>
      <!-- Comment with — em dash and 'quotes' -->
      <%# ERB comment with — dash and 'apostrophe' %>
    `

    const result = formatter.format(source)

    expect(result).toBe(dedent`
      <div>Content</div>

      <!-- Comment with — em dash and 'quotes' -->

      <%# ERB comment with — dash and 'apostrophe' %>
    `)
  })
})
