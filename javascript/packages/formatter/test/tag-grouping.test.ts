import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Formatter } from "../src"
import dedent from "dedent"

let formatter: Formatter

describe("Tag Grouping Behavior", () => {
  beforeAll(async () => {
    await Herb.load()

    formatter = new Formatter(Herb, {
      indentWidth: 2,
      maxLineLength: 80
    })
  })

  test("no grouping with alternating single tags (div, span, div) - no spacing", () => {
    const source = dedent`
      <div>
        <div>One</div>
        <span>Two</span>
        <div>Three</div>
      </div>
    `

    const result = formatter.format(source)

    expect(result).toEqual(dedent`
      <div>
        <div>One</div>
        <span>Two</span>
        <div>Three</div>
      </div>
    `)
  })

  test("grouping with 2+ consecutive same tags (div, div, span) - spacing at boundary", () => {
    const source = dedent`
      <div>
        <div>One</div>
        <div>Two</div>
        <span>Three</span>
      </div>
    `

    const result = formatter.format(source)

    expect(result).toEqual(dedent`
      <div>
        <div>One</div>
        <div>Two</div>

        <span>Three</span>
      </div>
    `)
  })

  test("all same tags stay grouped - no spacing within group", () => {
    const source = dedent`
      <div>
        <div>One</div>
        <div>Two</div>
        <div>Three</div>
        <div>Four</div>
      </div>
    `

    const result = formatter.format(source)

    expect(result).toEqual(dedent`
      <div>
        <div>One</div>
        <div>Two</div>
        <div>Three</div>
        <div>Four</div>
      </div>
    `)
  })

  test("multiple groups with spacing between them (meta, meta, link, link)", () => {
    const source = dedent`
      <head>
        <meta name="a" content="1">
        <meta name="b" content="2">
        <meta name="c" content="3">
        <link rel="stylesheet" href="1.css">
        <link rel="stylesheet" href="2.css">
      </head>
    `

    const result = formatter.format(source)

    expect(result).toEqual(dedent`
      <head>
        <meta name="a" content="1">
        <meta name="b" content="2">
        <meta name="c" content="3">

        <link rel="stylesheet" href="1.css">
        <link rel="stylesheet" href="2.css">
      </head>
    `)
  })

  test("single tags of different types - no spacing", () => {
    const source = dedent`
      <div>
        <section>A</section>
        <article>B</article>
        <aside>C</aside>
      </div>
    `

    const result = formatter.format(source)

    expect(result).toEqual(dedent`
      <div>
        <section>A</section>
        <article>B</article>
        <aside>C</aside>
      </div>
    `)
  })

  test("group followed by single different tag - spacing", () => {
    const source = dedent`
      <div>
        <p>One</p>
        <p>Two</p>
        <p>Three</p>
        <section>Different</section>
      </div>
    `

    const result = formatter.format(source)

    expect(result).toEqual(dedent`
      <div>
        <p>One</p>
        <p>Two</p>
        <p>Three</p>

        <section>Different</section>
      </div>
    `)
  })

  test("multiline elements always get spacing regardless of grouping", () => {
    const source = dedent`
      <div>
        <div>Short</div>
        <div class="this-is-a-very-long-class-name-that-will-cause-wrapping-to-multiple-lines">Multiline</div>
        <div>Short</div>
      </div>
    `

    const result = formatter.format(source)

    expect(result).toEqual(dedent`
      <div>
        <div>Short</div>

        <div class="this-is-a-very-long-class-name-that-will-cause-wrapping-to-multiple-lines">
          Multiline
        </div>

        <div>Short</div>
      </div>
    `)
  })
})
