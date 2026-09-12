import { describe, test, expect } from "vitest"

import { anchorEntries } from "../src/markup/anchors"
import { parseMarker, parseStaticsIdentity } from "../src/markup/markers"

import grammar from "./fixtures/markers.json"

function data(comment: string): string {
  const holder = document.createElement("div")

  holder.innerHTML = comment

  return (holder.firstChild as Comment).data.trim()
}

function element(markup: string): Element {
  const holder = document.createElement("div")

  holder.innerHTML = markup

  return holder.firstElementChild!
}

describe("the marker grammar SlotMarkers builds", () => {
  test("a slot opening with the default type", () => {
    expect(parseMarker(data(grammar.slot_open.child))).toEqual({ kind: "slot-open", index: 3, type: "child" })
  })

  test("a slot opening with a type", () => {
    expect(parseMarker(data(grammar.slot_open.conditional))).toEqual({ kind: "slot-open", index: 4, type: "conditional" })
    expect(parseMarker(data(grammar.slot_open.collection))).toEqual({ kind: "slot-open", index: 5, type: "collection" })
  })

  test("a slot closing", () => {
    expect(parseMarker(data(grammar.slot_close))).toEqual({ kind: "slot-close", index: 3 })
  })

  test("element anchors", () => {
    const anchored = element(`<div data-herb-slot="${grammar.element_anchors}"></div>`)

    expect(anchorEntries(anchored)).toEqual([
      { index: 6, type: "attribute", attribute: "class" },
      { index: 7, type: "child", attribute: null },
      { index: 8, type: "boolean_attribute", attribute: "muted" },
    ])
  })

  test("a branch", () => {
    expect(parseMarker(data(grammar.branch))).toEqual({ kind: "branch", index: 4, branch: "1" })
  })

  test("an item opening and closing, with the key taken verbatim", () => {
    expect(parseMarker(data(grammar.item_open))).toEqual({ kind: "item-open", index: 5, key: "a&b" })
    expect(parseMarker(data(grammar.item_close))).toEqual({ kind: "item-close", index: 5 })
  })

  test("a region opening and closing", () => {
    expect(parseMarker(data(grammar.region_open))).toEqual({
      kind: "region-open",
      file: "app/views/posts/_card.html.erb",
      version: "aaaaaaaa",
      occurrence: 2,
    })
    expect(parseMarker(data(grammar.region_close))).toEqual({ kind: "region-close", file: "app/views/posts/_card.html.erb" })
  })

  test("a statics container", () => {
    const container = element(`${grammar.statics_open}${grammar.statics_close}`)
    const named = container.getAttribute("data-herb-region")!

    expect(container.tagName).toBe("TEMPLATE")
    expect(parseStaticsIdentity(named)).toEqual({ file: "app/views/posts/_card.html.erb", version: "aaaaaaaa" })
  })
})
