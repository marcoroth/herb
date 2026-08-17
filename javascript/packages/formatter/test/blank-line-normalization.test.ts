import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Formatter } from "../src"

let formatter: Formatter

describe("Blank line normalization", () => {
  beforeAll(async () => {
    await Herb.load()

    formatter = new Formatter(Herb, {
      indentWidth: 2,
      maxLineLength: 80
    })
  })

  test("keeps a single blank line between elements", () => {
    const source = `<div>\n  <p>First</p>\n\n  <p>Second</p>\n</div>`

    expect(formatter.format(source)).toEqual(`<div>\n  <p>First</p>\n\n  <p>Second</p>\n</div>`)
  })

  test("keeps exactly two blank lines as an intentional wider break", () => {
    const source = `<div>\n  <p>First</p>\n\n\n  <p>Second</p>\n</div>`

    expect(formatter.format(source)).toEqual(`<div>\n  <p>First</p>\n\n\n  <p>Second</p>\n</div>`)
  })

  test("collapses three or more blank lines down to one", () => {
    const source = `<div>\n  <p>First</p>\n\n\n\n  <p>Second</p>\n</div>`

    expect(formatter.format(source)).toEqual(`<div>\n  <p>First</p>\n\n  <p>Second</p>\n</div>`)
  })

  test("collapses many blank lines down to one", () => {
    const source = `<div>\n  <p>First</p>\n\n\n\n\n\n\n  <p>Second</p>\n</div>`

    expect(formatter.format(source)).toEqual(`<div>\n  <p>First</p>\n\n  <p>Second</p>\n</div>`)
  })

  test("keeps two blank lines between top-level elements", () => {
    const source = `<header>\n  <h1>Title</h1>\n</header>\n\n\n<main>\n  <p>Content</p>\n</main>`

    expect(formatter.format(source)).toEqual(`<header>\n  <h1>Title</h1>\n</header>\n\n\n<main>\n  <p>Content</p>\n</main>`)
  })

  test("collapses three blank lines between top-level elements", () => {
    const source = `<header>\n  <h1>Title</h1>\n</header>\n\n\n\n<main>\n  <p>Content</p>\n</main>`

    expect(formatter.format(source)).toEqual(`<header>\n  <h1>Title</h1>\n</header>\n\n<main>\n  <p>Content</p>\n</main>`)
  })

  test("keeps two blank lines inside ERB control-flow bodies", () => {
    const source = `<% if condition %>\n  <p>First</p>\n\n\n  <p>Second</p>\n<% end %>`

    expect(formatter.format(source)).toEqual(`<% if condition %>\n  <p>First</p>\n\n\n  <p>Second</p>\n<% end %>`)
  })

  test("collapses excess blank lines inside ERB control-flow bodies", () => {
    const source = `<% if condition %>\n  <p>First</p>\n\n\n\n\n  <p>Second</p>\n<% end %>`

    expect(formatter.format(source)).toEqual(`<% if condition %>\n  <p>First</p>\n\n  <p>Second</p>\n<% end %>`)
  })

  test("two-blank-line output is idempotent", () => {
    const source = `<div>\n  <p>First</p>\n\n\n  <p>Second</p>\n</div>`
    const once = formatter.format(source)
    const twice = formatter.format(once)

    expect(twice).toEqual(once)
  })
})
