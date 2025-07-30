import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Formatter } from "../../src"

import dedent from "dedent"

let formatter: Formatter

describe("@herb-tools/formatter", () => {
  beforeAll(async () => {
    await Herb.load()

    formatter = new Formatter(Herb, {
      indentWidth: 2,
      maxLineLength: 80
    })
  })

  test("does not wrap single attribute", () => {
    const source = dedent`
      <div class="foo"></div>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <div class="foo"></div>
    `)
  })

  test("keeps 2 attributes inline", () => {
    const source = dedent`
      <div class="foo" id="bar"></div>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <div class="foo" id="bar"></div>
    `)
  })

  test("keeps 3 attributes inline", () => {
    const source = dedent`
      <div class="foo" id="bar" data-test="value"></div>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <div class="foo" id="bar" data-test="value"></div>
    `)
  })

  test("wraps 4+ attributes correctly", () => {
    const source = dedent`
      <div class="foo" id="bar" data-test="value" role="button"></div>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <div
        class="foo"
        id="bar"
        data-test="value"
        role="button"
      ></div>
    `)
  })

  test("keeps empty attribute values inline when ≤3 attributes", () => {
    const source = dedent`
      <div id=""></div>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <div id=""></div>
    `)
  })

  test("keeps multiple empty attributes inline when <= 3 attributes", () => {
    const source = dedent`
      <div id="" class="" data-value=""></div>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <div id="" class="" data-value=""></div>
    `)
  })

  test("splits multiple empty attributes inline when > 3 attributes", () => {
    const source = dedent`
      <div id="" class="" data-value="" another-value=""></div>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <div
        id=""
        class=""
        data-value=""
        another-value=""
      ></div>
    `)
  })

  test("formats self-closing input without attributes", () => {
    const source = dedent`
      <input />
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <input />
    `)
  })

  test("formats input without closing slash", () => {
    const source = dedent`
      <input>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <input>
    `)
  })

  test("formats self-closing input with boolean attribute", () => {
    const source = dedent`
      <input required />
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <input required />
    `)
  })

  test("formats input with boolean attribute without closing slash", () => {
    const source = dedent`
      <input required>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <input required>
    `)
  })

  test("formats self-closing input with 4+ attributes", () => {
    const source = dedent`
      <input type="text" name="username" required readonly />
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <input
        type="text"
        name="username"
        required
        readonly
      />
    `)
  })

  test("formats input with 4+ attributes without closing slash", () => {
    const source = dedent`
      <input type="text" name="username" required readonly>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <input
        type="text"
        name="username"
        required
        readonly
      >
    `)
  })

  test("preserves inline ERB conditionals in tags", () => {
    const source = dedent`
      <span<% if "x" == "x" %>class="is-x"<% end %>></span>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <span <% if "x" == "x" %> class="is-x" <% end %>></span>
    `)
  })

  test("preserves inline ERB conditionals with content", () => {
    const source = dedent`
      <div<% if condition %>class="active"<% end %>>Content</div>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <div <% if condition %> class="active" <% end %>>
        Content
      </div>
    `)
  })

  test("preserves inline ERB conditionals with multiple attributes", () => {
    const source = dedent`
      <div id="test"<% if show_class %>class="visible"<% end %> data-value="123">Content</div>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <div id="test" <% if show_class %> class="visible" <% end %> data-value="123">
        Content
      </div>
    `)
  })
})
