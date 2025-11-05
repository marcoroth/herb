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

  test("formats ERB case/when/else statements", () => {
    const source = dedent`
      <% case status %><% when "ok" %>GOOD<% when "error" %>BAD<% else %>UNKNOWN<% end %>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <% case status %>
      <% when "ok" %>
        GOOD
      <% when "error" %>
        BAD
      <% else %>
        UNKNOWN
      <% end %>
    `)
  })

  test("formats ERB case/when/else statements inside element", () => {
    const source = dedent`
      <div><% case status %><% when "ok" %>GOOD<% when "error" %>BAD<% else %>UNKNOWN<% end %></div>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <div>
        <% case status %>
        <% when "ok" %>
          GOOD
        <% when "error" %>
          BAD
        <% else %>
          UNKNOWN
        <% end %>
      </div>
    `)
  })

  test("formats ERB case/in statements", () => {
    const source = dedent`
      <% case { hash: { nested: '4' } } %>
            <% in { hash: { nested: } } %>
      <span>there</span>
              <% in { another: } %>
      <span>there</span>
      <% in { yet_another: { nested: } } %>
             <span>hi</span>
            <% else %>
      <span>there</span>
        <% end %>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <% case { hash: { nested: '4' } } %>
      <% in { hash: { nested: } } %>
        <span>there</span>
      <% in { another: } %>
        <span>there</span>
      <% in { yet_another: { nested: } } %>
        <span>hi</span>
      <% else %>
        <span>there</span>
      <% end %>
    `)
  })

  test("formats ERB case/in/else statements", () => {
    const source = dedent`
      <% case { hash: { nested: '4' } } %>
            <% in { hash: { nested: } } %>
            2
              <% else %>
              3

      <% end %>
    `
    const result = formatter.format(source)
    expect(result).toEqual(dedent`
      <% case { hash: { nested: '4' } } %>
      <% in { hash: { nested: } } %>
        2
      <% else %>
        3
      <% end %>
    `)
  })

  test("formats ERB case with when and no else", () => {
    const input = dedent`
      <% case user_type %>
      <% when :admin %>
      <p>Admin Panel</p>
      <% when :user %>
      <p>User Dashboard</p>
      <% end %>
    `

    const expected = dedent`
      <% case user_type %>
      <% when :admin %>
        <p>Admin Panel</p>
      <% when :user %>
        <p>User Dashboard</p>
      <% end %>
    `

    const output = formatter.format(input)
    expect(output).toEqual(expected)
  })

  test("case without surrounding spaces", () => {
    const input = dedent`
      <%case status%>
      <%when "ok"%>
      <%else%>
      <%end%>
    `

    const expected = dedent`
      <% case status %>
      <% when "ok" %>
      <% else %>
      <% end %>
    `

    const output = formatter.format(input)
    expect(output).toEqual(expected)
  })

  test("case/when with children", () => {
    const input = dedent`
      <% case variable %>
        <h1>Children</h1>
      <% when Integer %>
        <h1>Integer</h1>
      <% when String %>
        <h1>String</h1>
      <% else %>
        <h1>else</h1>
      <% end %>
    `

    const output = formatter.format(input)
    expect(output).toEqual(input)
  })

  test("case/in with children", () => {
    const input = dedent`
      <% case { hash: { nested: '4' } } %>
        <span>children</span>
      <% in { hash: { nested: } } %>
        <span>nested</span>
      <% else %>
        <span>else</span>
      <% end %>
    `

    const output = formatter.format(input)
    expect(output).toEqual(input)
  })
})
