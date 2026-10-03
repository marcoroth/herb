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

  test("splits an else that closes the block in the same ERB tag", () => {
    const source = dedent`
      <% if a %>
        x
      <% else
        y
      end %>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <% if a %>
        x
      <% else
        y %>
      <% end %>
    `)
  })

  test("splits an elsif that closes the block in the same ERB tag", () => {
    const source = dedent`
      <% if a %>
        x
      <% elsif b
        y
      end %>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <% if a %>
        x
      <% elsif b
        y %>
      <% end %>
    `)
  })

  test("splits a when that closes the case in the same ERB tag", () => {
    const source = dedent`
      <% case t %>
      <% when 1
        a
      end %>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <% case t %>
      <% when 1
        a %>
      <% end %>
    `)
  })

  test("splits a rescue that closes the block in the same ERB tag", () => {
    const source = dedent`
      <% begin %>
        x
      <% rescue
        y
      end %>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <% begin %>
        x
      <% rescue
        y %>
      <% end %>
    `)
  })

  test("splits an ensure that closes the block in the same ERB tag", () => {
    const source = dedent`
      <% begin %>
        x
      <% ensure
        y
      end %>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <% begin %>
        x
      <% ensure
        y %>
      <% end %>
    `)
  })

  test("splits the else reported in the original issue", () => {
    const source = dedent`
      <% case type %>
      <% when "A" %>
        a
      <%
      else
        raise
      end
      %>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <% case type %>
      <% when "A" %>
        a
      <% else
        raise %>
      <% end %>
    `)
  })

  test("leaves a case and its conditions in separate tags alone", () => {
    const source = dedent`
      <% if a %>
        x
      <% else %>
        y
      <% end %>
    `
    expect(formatter.format(source)).toEqual(source)
  })
})
