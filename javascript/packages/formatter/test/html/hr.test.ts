import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Formatter } from "../../src"

import dedent from "dedent"

let formatter: Formatter

describe("<hr>", () => {
  beforeAll(async () => {
    await Herb.load()

    formatter = new Formatter(Herb, {
      indentWidth: 2,
      maxLineLength: 80
    })
  })

  test("hr elements on separate lines stay formatted", () => {
    const source = dedent`
      <div>
        Section 1
        <hr>
        Section 2
        <hr>
        Section 3
      </div>
    `
    const result = formatter.format(source)
    const expected = dedent`
      <div>
        Section 1
        <hr>
        Section 2
        <hr>
        Section 3
      </div>
    `
    expect(result).toEqual(expected)
  })

  test("inline hr elements get formatted on separate lines", () => {
    const source = dedent`
      <div>
        Before <hr> After
      </div>
    `
    const result = formatter.format(source)
    const expected = dedent`
      <div>
        Before
        <hr>
        After
      </div>
    `
    expect(result).toEqual(expected)
  })

  test("hr with attributes", () => {
    const source = dedent`
      <div>
        Content above
        <hr class="divider" style="margin: 20px 0;">
        Content below
      </div>
    `
    const result = formatter.format(source)
    const expected = dedent`
      <div>
        Content above
        <hr class="divider" style="margin: 20px 0;">
        Content below
      </div>
    `
    expect(result).toEqual(expected)
  })

  test("multiple consecutive hr elements", () => {
    const source = dedent`
      <div>
        Section 1
        <hr><hr><hr>
        Section 2
      </div>
    `
    const result = formatter.format(source)
    const expected = dedent`
      <div>
        Section 1
        <hr>
        <hr>
        <hr>
        Section 2
      </div>
    `
    expect(result).toEqual(expected)
  })

  test("hr with ERB content", () => {
    const source = dedent`
      <div>
        <h2><%= @title %></h2>
        <hr>
        <% @items.each do |item| %>
          <p><%= item %></p>
          <hr class="item-separator">
        <% end %>
      </div>
    `
    const result = formatter.format(source)
    const expected = dedent`
      <div>
        <h2><%= @title %></h2>

        <hr>

        <% @items.each do |item| %>
          <p><%= item %></p>
          <hr class="item-separator">
        <% end %>
      </div>
    `
    expect(result).toEqual(expected)
  })

  test("hr at element boundaries", () => {
    const source = dedent`
      <div><hr>Starting with hr</div>
      <div>Ending with hr<hr></div>
      <div><hr></div>
    `
    const result = formatter.format(source)
    const expected = dedent`
      <div>
        <hr>
        Starting with hr
      </div>

      <div>
        Ending with hr
        <hr>
      </div>

      <div>
        <hr>
      </div>
    `
    expect(result).toEqual(expected)
  })

  test("hr between articles", () => {
    const source = dedent`
      <main>
        <article>
          <h3>Article 1</h3>
          <p>Content of first article.</p>
        </article>
        <hr class="article-separator">
        <article>
          <h3>Article 2</h3>
          <p>Content of second article.</p>
        </article>
      </main>
    `
    const result = formatter.format(source)
    const expected = dedent`
      <main>
        <article>
          <h3>Article 1</h3>
          <p>Content of first article.</p>
        </article>

        <hr class="article-separator">

        <article>
          <h3>Article 2</h3>
          <p>Content of second article.</p>
        </article>
      </main>
    `
    expect(result).toEqual(expected)
  })

  test("hr with mixed void elements", () => {
    const source = dedent`
      <div>
        Text before
        <br><hr><br>
        Text after
      </div>
    `
    const result = formatter.format(source)
    const expected = dedent`
      <div>
        Text before
        <br>
        <hr>
        <br>
        Text after
      </div>
    `
    expect(result).toEqual(expected)
  })

  test("compact hr gets formatted on separate lines", () => {
    const source = dedent`
      <div>A<hr>B</div>
    `
    const result = formatter.format(source)
    const expected = dedent`
      <div>
        A
        <hr>
        B
      </div>
    `
    expect(result).toEqual(expected)
  })

  test("hr with long attributes and complex content", () => {
    const source = dedent`
      <section>
        Introduction text
        <hr style="border: none; height: 2px; background: linear-gradient(to right, #ff0000, #00ff00, #0000ff); margin: 30px 0;">
        Main content with <strong>emphasis</strong>
        <a href="/link" style="color: blue; text-decoration: underline;">and links</a>
      </section>
    `
    const result = formatter.format(source)
    const expected = dedent`
      <section>
        Introduction text
        <hr
          style="border: none; height: 2px; background: linear-gradient(to right, #ff0000, #00ff00, #0000ff); margin: 30px 0;"
        >
        Main content with
        <strong>emphasis</strong>
        <a href="/link" style="color: blue; text-decoration: underline;">and links</a>
      </section>
    `
    expect(result).toEqual(expected)
  })
})
