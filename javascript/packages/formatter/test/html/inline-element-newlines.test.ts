import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "@herb-tools/node-wasm"
import { Formatter } from "../../src"
import { createExpectFormattedToMatch } from "../helpers"

import dedent from "dedent"

let formatter: Formatter
let wideFormatter: Formatter
let expectFormattedToMatch: ReturnType<typeof createExpectFormattedToMatch>
let expectWideFormattedToMatch: ReturnType<typeof createExpectFormattedToMatch>

describe("@herb-tools/formatter", () => {
  beforeAll(async () => {
    await Herb.load()

    formatter = new Formatter(Herb, {
      indentWidth: 2,
      maxLineLength: 80
    })

    wideFormatter = new Formatter(Herb, {
      indentWidth: 2,
      maxLineLength: 120
    })

    expectFormattedToMatch = createExpectFormattedToMatch(formatter)
    expectWideFormattedToMatch = createExpectFormattedToMatch(wideFormatter)
  })

  describe("newlines inside inline elements that start their own line", () => {
    test("keeps an inline element expanded when the author broke out its content", () => {
      expectWideFormattedToMatch(dedent`
        <div class="flex flex-col w-full flex-1 self-center">
          <span class="text-lg font-semibold sm:text-md">
            <%= upcoming_event.name %> is coming up!
          </span>
        </div>
      `)
    })

    test("keeps an inline element expanded even when it would fit on one line", () => {
      expectWideFormattedToMatch(dedent`
        <nav>
          <a href="/events" class="underline">
            All events
          </a>
        </nav>
      `)
    })

    test("keeps nested inline elements expanded", () => {
      expectWideFormattedToMatch(dedent`
        <div class="outer">
          <span class="a">
            <strong>
              <%= user.name %>
            </strong>
          </span>
        </div>
      `)
    })

    test("keeps an inline element expanded around ERB control flow", () => {
      expectWideFormattedToMatch(dedent`
        <span>
          <% if valid? %>
            Valid
          <% else %>
            Invalid
          <% end %>
        </span>
      `)
    })

    test("still collapses an inline element the author wrote on one line", () => {
      expectWideFormattedToMatch(dedent`
        <div class="outer">
          <span class="text-lg"><%= upcoming_event.name %> is coming up!</span>
        </div>
      `)
    })

    test("still collapses an inline element glued to its siblings", () => {
      const source = dedent`
        <div><span>
          <em>a</em>
          <em>b</em>
        </span></div>
      `

      expect(wideFormatter.format(source)).toEqual(`<div><span><em>a</em> <em>b</em></span></div>`)
    })

    test("still collapses an inline element inside a running text flow", () => {
      const source = dedent`
        <p>
          Some leading text <span class="badge">
            <%= count %>
          </span> and some trailing text.
        </p>
      `

      expect(wideFormatter.format(source)).toEqual(dedent`
        <p>
          Some leading text <span class="badge"><%= count %></span> and some trailing text.
        </p>
      `)
    })

    test("keeps content that does not fit expanded, as before", () => {
      expectFormattedToMatch(dedent`
        <div class="outer">
          <span class="opacity-80 text-sm mt-1">
            <%= upcoming_event.location %> &bull; <%= upcoming_event.formatted_dates %>
          </span>
        </div>
      `)
    })

    test("matches the behaviour block elements already had", () => {
      expectWideFormattedToMatch(dedent`
        <div class="outer">
          <div class="text-lg font-semibold sm:text-md">
            <%= upcoming_event.name %> is coming up!
          </div>
        </div>
      `)
    })
  })
})
