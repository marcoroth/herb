import { describe, test, expect, beforeEach } from "vitest"
import { Slots } from "../src/slots/slots"

const FILE = "app/views/chat/show.html.erb"

const MANIFEST = {
  file: FILE,
  identifier: FILE,
  version: "aaaaaaaa",
  names: {},
  parts: { 1: ["message_", ""], 2: ["row-", "-of-", ""] },
  states: null,
}

const MANIFEST_TAG = `<template data-herb-manifests>${JSON.stringify({ [`${FILE}:aaaaaaaa`]: MANIFEST })}</template>`

const PAGE =
  `<!--herb-region:${FILE}:aaaaaaaa:0-->` +
  `<ul><!--herb-slot:0:collection-->` +
  `<!--herb-item:0:1--><li id="message_1" data-herb-slot="1:attribute_interpolation:id 2:attribute_interpolation:class">` +
  `<span data-herb-slot="3:child">hello</span></li><!--/herb-item:0-->` +
  `<!--/herb-slot:0--></ul>` +
  `<template data-herb-region="${FILE}:aaaaaaaa">` +
  `<!--herb-branch:0:item--><!--herb-item:0:--><li id="" class="" data-herb-slot="1:attribute_interpolation:id 2:attribute_interpolation:class">` +
  `<span data-herb-slot="3:child"></span></li><!--/herb-item:0-->` +
  `</template>` +
  `<!--/herb-region:${FILE}-->` + MANIFEST_TAG

let slots: Slots

function row(selector: string): HTMLElement | null {
  return document.querySelector(selector)
}

beforeEach(() => {
  document.body.innerHTML = PAGE

  slots = new Slots()
  slots.scan(document.body)
})

describe("interpolated attribute slots", () => {
  test("a payload's dynamic parts reconstruct the whole attribute", () => {
    const report = slots.apply({
      template: FILE,
      version: "aaaaaaaa",
      occurrence: 0,
      slots: { 0: { items: { 1: { 1: ["9"], 2: ["a", "b"], 3: "updated" } } } },
    })

    expect(report.deferred).toEqual([])
    expect(row("li")?.id).toBe("message_9")
    expect(row("li")?.className).toBe("row-a-of-b")
  })

  test("the revert restores the previous whole value", () => {
    const { token } = slots.transaction(() => slots.apply({
      template: FILE,
      version: "aaaaaaaa",
      occurrence: 0,
      slots: { 0: { items: { 1: { 1: ["9"] } } } },
    }))

    expect(row("li")?.id).toBe("message_9")

    slots.revert(token!)

    expect(row("li")?.id).toBe("message_1")
  })

  test("a row built from parked statics interpolates the values it is given", () => {
    const collection = slots.slot(FILE, 0)!
    const item = slots.addItem(collection, "7", { values: { id: "7", class: ["x", "y"] } })

    expect(item).not.toBeNull()

    const fresh = document.querySelectorAll("li")[1]

    expect(fresh.id).toBe("message_7")
    expect(fresh.className).toBe("row-x-of-y")
  })

  test("an unchanged value applies without touching the attribute", () => {
    const before = row("li")!.id

    const report = slots.apply({
      template: FILE,
      version: "aaaaaaaa",
      occurrence: 0,
      slots: { 0: { items: { 1: { 1: ["1"] } } } },
    })

    expect(report.deferred).toEqual([])
    expect(row("li")?.id).toBe(before)
  })

  test("a slot whose parts the manifest does not carry still defers", () => {
    document.body.innerHTML = PAGE.replace(JSON.stringify(MANIFEST.parts), JSON.stringify({ 2: MANIFEST.parts[2] }))

    const bare = new Slots()
    bare.scan(document.body)

    const report = bare.apply({
      template: FILE,
      version: "aaaaaaaa",
      occurrence: 0,
      slots: { 0: { items: { 1: { 1: ["9"] } } } },
    })

    expect(report.deferred.map((deferred) => deferred.reason)).toContain("partial-attribute")
    expect(row("li")?.id).toBe("message_1")
  })
})
