import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Formatter } from "../src"
import { createExpectFormattedToMatch } from "./helpers"
import dedent from "dedent"

let formatter: Formatter
let expectFormattedToMatch: ReturnType<typeof createExpectFormattedToMatch>

describe("Multiline Element Spacing", () => {
  beforeAll(async () => {
    await Herb.load()

    formatter = new Formatter(Herb, {
      indentWidth: 2,
      maxLineLength: 80
    })
    expectFormattedToMatch = createExpectFormattedToMatch(formatter)
  })

  test("adds spacing around multiline elements", () => {
    const source = dedent`
      <div>
        <meta name="x">
        <div><p>Content here with nested element</p></div>
        <meta name="y">
      </div>
    `

    const result = formatter.format(source)

    expect(result).toEqual(dedent`
      <div>
        <meta name="x">

        <div>
          <p>Content here with nested element</p>
        </div>

        <meta name="y">
      </div>
    `)
  })

  test("one blank line between two multiline elements", () => {
    const source = dedent`
      <div>
        <div><p>First</p></div>
        <div><p>Second</p></div>
        <section><p>Third</p></section>
      </div>
    `

    const result = formatter.format(source)

    expect(result).toEqual(dedent`
      <div>
        <div>
          <p>First</p>
        </div>

        <div>
          <p>Second</p>
        </div>

        <section>
          <p>Third</p>
        </section>
      </div>
    `)
  })

  test("single-line elements stay grouped", () => {
    expectFormattedToMatch(dedent`
      <div>
        <meta name="a">
        <meta name="b">
        <meta name="c">
        <meta name="d">
      </div>
    `)
  })

  test("mixed single-line and multiline elements", () => {
    const source = dedent`
      <div>
        <meta name="a">
        <meta name="b">
        <div><p>Multiline content</p></div>
        <meta name="c">
        <div><p>More content</p></div>
      </div>
    `

    const result = formatter.format(source)

    expect(result).toEqual(dedent`
      <div>
        <meta name="a">
        <meta name="b">

        <div>
          <p>Multiline content</p>
        </div>

        <meta name="c">

        <div>
          <p>More content</p>
        </div>
      </div>
    `)
  })

  test("elements with single ERB tag stay single-line", () => {
    const source = dedent`
      <urlset>
        <loc><%= page_url(page) %></loc>
        <changefreq><%= page.change_frequency || 'monthly' %></changefreq>
        <priority><%= page.priority %></priority>
      </urlset>
    `

    const result = formatter.format(source)

    expect(result).toEqual(dedent`
      <urlset>
        <loc><%= page_url(page) %></loc>
        <changefreq><%= page.change_frequency || 'monthly' %></changefreq>
        <priority><%= page.priority %></priority>
      </urlset>
    `)
  })
})
