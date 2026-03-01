import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Formatter } from "../src"
import { createExpectFormattedToMatch } from "./helpers"

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

  test("preserves YAML frontmatter with no formatting", () => {
    expectFormattedToMatch(dedent`
      ---
      title: My Page
      layout: application
      published: true
      ---

      <div class="container">
        <h1><%= @title %></h1>
      </div>
    `)
  })

  test("preserves frontmatter with ERB content after it", () => {
    expectFormattedToMatch(dedent`
      ---
      title: Test
      ---

      <% if Rails.env.development? %>
        <p>Debug mode</p>
      <% end %>
    `)
  })

  test("preserves frontmatter indentation as-is", () => {
    expectFormattedToMatch(dedent`
      ---
      nested:
        key: value
        another:
          deep: true
      ---

      <div>Content</div>
    `)
  })

  test("normalizes whitespace after frontmatter", () => {
    const source = dedent`
      ---
      title: Test
      ---




      <div>Content</div>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      ---
      title: Test
      ---

      <div>Content</div>
    `)
  })

  test("handles frontmatter with arrays and objects", () => {
    expectFormattedToMatch(dedent`
      ---
      tags:
        - ruby
        - rails
        - erb
      metadata:
        author: John Doe
        date: 2024-01-01
      ---

      <article>
        <h1>Title</h1>
      </article>
    `)
  })

  test("formats HTML but preserves frontmatter when HTML is messy", () => {
    const source = dedent`
      ---
      title: Test
      ---

      <div    class="container"   >
          <h1>Title</h1>
            <p>Text</p>
      </div>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      ---
      title: Test
      ---

      <div class="container">
        <h1>Title</h1>
        <p>Text</p>
      </div>
    `)
  })

  test("does not treat --- in the middle of document as frontmatter", () => {
    expectFormattedToMatch(dedent`
      <div>
        <p>Some content</p>
        ---
        <p>More content</p>
      </div>
    `)
  })

  test("frontmatter must end with --- on its own line", () => {
    const source = dedent`
      ---
      title: Test --- not closing
      <div>Content</div>
    `
    const result = formatter.format(source)

    expect(result).toEqual(dedent`
      --- title: Test --- not closing
      <div>Content</div>
    `)
  })

  test("empty frontmatter block", () => {
    expectFormattedToMatch(dedent`
      ---
      ---

      <div>Content</div>
    `)
  })

  test("frontmatter with comments", () => {
    expectFormattedToMatch(dedent`
      ---
      # This is a YAML comment
      title: My Page
      # Another comment
      layout: application
      ---

      <div>Content</div>
    `)
  })

  test("frontmatter adds newline", () => {
    const source = dedent`
      ---
      title: My Page
      ---
      <div>Content</div>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      ---
      title: My Page
      ---

      <div>Content</div>
    `)
  })

  test("frontmatter with no newline after ---", () => {
    const source = dedent`
      ---
      title: My Page
      ---<div>Content</div>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      ---
      title: My Page
      ---

      <div>Content</div>
    `)
  })

  // TODO: maybe we can improve this in the future
  test("frontmatter with text after ---", () => {
    const source = dedent`
      ---
      title: My Page
      ---
      Content
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      --- title: My Page --- Content
    `)
  })
})
