import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Formatter } from "../../src"

import dedent from "dedent"

let formatter: Formatter

describe("<br>", () => {
  beforeAll(async () => {
    await Herb.load()

    formatter = new Formatter(Herb, {
      indentWidth: 2,
      maxLineLength: 80
    })
  })

  test("br elements on separate lines stay formatted", () => {
    const source = dedent`
      <p>
        Before
        <br>
        After
        <br>
      </p>
    `
    const result = formatter.format(source)
    const expected = dedent`
      <p>
        Before <br>
        After <br>
      </p>
    `
    expect(result).toEqual(expected)
  })

  test("inline br elements get formatted on separate lines", () => {
    const source = dedent`
      <p>
        Before <br>
        After <br>
      </p>
    `
    const result = formatter.format(source)
    const expected = dedent`
      <p>
        Before <br>
        After <br>
      </p>
    `
    expect(result).toEqual(expected)
  })

  test("compact br elements stay inline", () => {
    const source = dedent`
      <p>Before <br>After <br></p>
    `
    const result = formatter.format(source)
    const expected = dedent`
      <p>
        Before <br>
        After <br>
      </p>
    `
    expect(result).toEqual(expected)
  })

  test("very compact br elements stay inline", () => {
    const source = dedent`
      <p>Before<br>After<br></p>
    `
    const result = formatter.format(source)
    const expected = dedent`
      <p>
        Before<br>
        After<br>
      </p>
    `
    expect(result).toEqual(expected)
  })

  test("multiple consecutive br elements", () => {
    const source = dedent`
      <p>
        Line 1
        <br><br><br>
        Line 2
      </p>
    `
    const result = formatter.format(source)
    const expected = dedent`
      <p>
        Line 1
        <br>
        <br>
        <br>
        Line 2
      </p>
    `
    expect(result).toEqual(expected)
  })

  test("br with ERB content", () => {
    const source = dedent`
      <p>
        Hello <%= user.name %>
        <br>
        <% if user.address %>
          <%= user.address %>
          <br>
        <% end %>
        Thanks!
      </p>
    `
    const result = formatter.format(source)
    const expected = dedent`
      <p>
        Hello <%= user.name %><br>
        <% if user.address %>
          <%= user.address %><br>
        <% end %>
        Thanks!
      </p>
    `
    expect(result).toEqual(expected)
  })

  test("br inside inline elements", () => {
    const source = dedent`
      <p>
        <strong>Important:<br>Read this!</strong>
        <em>Note:<br>Also this!</em>
      </p>
    `
    const result = formatter.format(source)
    const expected = dedent`
      <p>
        <strong>
          Important: <br>
          Read this!
        </strong>
        <em>
          Note: <br>
          Also this!
        </em>
      </p>
    `
    expect(result).toEqual(expected)
  })

  test("address formatting with br", () => {
    const source = dedent`
      <address>
        John Doe<br>
        123 Main St<br>
        City, State 12345<br>
        <a href="mailto:john@example.com">john@example.com</a>
      </address>
    `
    const result = formatter.format(source)
    const expected = dedent`
      <address>
        John Doe<br>
        123 Main St<br>
        City, State 12345<br>
        <a href="mailto:john@example.com">john@example.com</a>
      </address>
    `
    expect(result).toEqual(expected)
  })

  test("br at element boundaries", () => {
    const source = dedent`
      <p><br>Starting with br</p>
      <p>Ending with br<br></p>
      <p><br></p>
    `
    const result = formatter.format(source)
    const expected = dedent`
      <p>
        <br>
        Starting with br
      </p>

      <p>Ending with br<br></p>

      <p><br></p>
    `
    expect(result).toEqual(expected)
  })

  test("br with mixed inline elements", () => {
    const source = dedent`
      <p>
        <span>Before</span><br><strong>After</strong><br><em>End</em>
      </p>
    `
    const result = formatter.format(source)
    const expected = dedent`
      <p>
        <span>Before</span><br>
        <strong>After</strong><br>
        <em>End</em>
      </p>
    `
    expect(result).toEqual(expected)
  })

  test("br in poetry-style content", () => {
    const source = dedent`
      <div class="poem">
        Roses are red,<br>
        Violets are blue,<br>
        This is a test,<br>
        For formatting too.
      </div>
    `
    const result = formatter.format(source)
    const expected = dedent`
      <div class="poem">
        Roses are red, <br>
        Violets are blue, <br>
        This is a test, <br>
        For formatting too.
      </div>
    `
    expect(result).toEqual(expected)
  })

  test("p with br and inline/block elements formats correctly", () => {
    const source = dedent`
      <p>
        Before
        <br>
        After
        <a href="/" style="just some content that forces the a-tag (or probably an inline element in general) to be put on a newline">Needs text here</a>
      </p>

      <p>
        Before
        <br>
        After
        <div href="/" style="just some content that forces the element be to be put on a newline (seems to work with block-elements">Needs text here</div>
      </p>
    `
    const result = formatter.format(source)
    const expected = dedent`
      <p>
        Before <br>
        After
        <a
          href="/"
          style="just some content that forces the a-tag (or probably an inline element in general) to be put on a newline"
        >
          Needs text here
        </a>
      </p>

      <p>
        Before <br>
        After
        <div
          href="/"
          style="just some content that forces the element be to be put on a newline (seems to work with block-elements"
        >
          Needs text here
        </div>
      </p>
    `
    expect(result).toEqual(expected)
  })
})
