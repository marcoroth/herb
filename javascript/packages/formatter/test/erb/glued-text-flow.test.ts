import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Formatter } from "../../src"
import { createExpectFormattedToMatch } from "../helpers"

import dedent from "dedent"

let formatter: Formatter
let expectFormattedToMatch: ReturnType<typeof createExpectFormattedToMatch>

describe("ERB glued text flow", () => {
  beforeAll(async () => {
    await Herb.load()

    formatter = new Formatter(Herb, {
      indentWidth: 2,
      maxLineLength: 80
    })

    expectFormattedToMatch = createExpectFormattedToMatch(formatter)
  })

  test("does not split text glued to ERB output inside an if", () => {
    const source = dedent`
      <p>
        Hello
        <% if user %>
          <%= user.name %>'s dog
        <% end %>
      </p>
    `

    expectFormattedToMatch(source)
  })

  test("does not split text glued to ERB output when if starts inline", () => {
    const source = dedent`
      <p>
        Hello<% if owner %> <%= owner.name %>'s dog<% end %>!
        It's time for your walk.
      </p>
    `

    const expected = dedent`
      <p>
        Hello<% if owner %> <%= owner.name %>'s dog<% end %>! It's time for your walk.
      </p>
    `

    expect(formatter.format(source)).toEqual(expected)
    expectFormattedToMatch(expected)
  })

  test("keeps punctuation glued to ERB output alongside block content in an if", () => {
    const source = dedent`
      <% if something? %>
        <%= @user.preferred_greeting %>,<br>
        <br>
        <p>blah blah</p>
      <% end %>
    `

    const expected = dedent`
      <% if something? %>
        <%= @user.preferred_greeting %>,<br>
        <br>
        <p>blah blah</p>
      <% end %>
    `

    expect(formatter.format(source)).toEqual(expected)
    expectFormattedToMatch(expected)
  })

  test("keeps punctuation glued to ERB output inside a block", () => {
    const source = dedent`
      <% capture do %>
        <%= @user.preferred_greeting %>,<br>
        <br>
        <p>blah blah</p>
      <% end %>
    `

    const expected = dedent`
      <% capture do %>
        <%= @user.preferred_greeting %>,<br>
        <br>
        <p>blah blah</p>
      <% end %>
    `

    expect(formatter.format(source)).toEqual(expected)
    expectFormattedToMatch(expected)
  })

  test("keeps ERB output glued to preceding text inside an if", () => {
    const source = dedent`
      <p>
        <% if user %>
          Hello <%= user.name %>, welcome back
        <% end %>
      </p>
    `

    expectFormattedToMatch(source)
  })

})
