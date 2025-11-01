import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Formatter } from "../../src"

import dedent from "dedent"

let formatter: Formatter

describe("@herb-tools/formatter - inline elements", () => {
  beforeAll(async () => {
    await Herb.load()

    formatter = new Formatter(Herb, {
      indentWidth: 2,
      maxLineLength: 80
    })
  })

  test("preserves inline elements in text flow (issue #251)", () => {
    const source = dedent`
      <p>Em<em>pha</em>sis</p>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <p>Em<em>pha</em>sis</p>
    `)
  })

  test("preserves strong elements inline", () => {
    const source = dedent`
      <p>This is <strong>important</strong> text.</p>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <p>This is <strong>important</strong> text.</p>
    `)
  })

  test("preserves span elements inline", () => {
    const source = dedent`
      <div>Some <span>inline</span> content</div>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <div>Some <span>inline</span> content</div>
    `)
  })

  test("preserves links with attributes inline", () => {
    const source = dedent`
      <p>A <a href="/link">link</a> in text</p>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <p>A <a href="/link">link</a> in text</p>
    `)
  })

  test("preserves multiple inline elements", () => {
    const source = dedent`
      <p>This has <em>emphasis</em> and <strong>strong</strong> text.</p>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <p>This has <em>emphasis</em> and <strong>strong</strong> text.</p>
    `)
  })

  test("preserves nested inline elements", () => {
    const source = dedent`
      <p>This is <strong>very <em>important</em></strong> text.</p>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <p>This is <strong>very <em>important</em></strong> text.</p>
    `)
  })

  test("preserves code elements inline", () => {
    const source = dedent`
      <p>Use the <code>foo()</code> function.</p>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
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
    const source = dedent`
      <p>The price is <del>$50</del> <ins>$40</ins>.</p>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
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
    const source = dedent`
      <p>Visit <a href="/page" class="link" target="_blank">our page</a> today.</p>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <p>Visit <a href="/page" class="link" target="_blank">our page</a> today.</p>
    `)
  })

  test("normalizes malformed closing tag placement", () => {
    const source = dedent`
      <p>
        Em<em>pha</em>sis</p>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <p>Em<em>pha</em>sis</p>
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
      <p>Em<em>pha</em>sis</p>
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
    const source = dedent`
      <h2 class="title">Posts (<%= @posts.count %>)</h2>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <h2 class="title">Posts (<%= @posts.count %>)</h2>
    `)
  })
})
