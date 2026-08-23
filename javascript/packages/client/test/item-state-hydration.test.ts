import { describe, test, expect, beforeEach } from "vitest"
import { SlotIndex } from "../src/slot-index"
import { SlotState } from "../src/state"

const FILE = "app/views/chat/show.html.erb"

const PAGE =
  `<!--herb-region:${FILE}:eeeeeeee:0-->` +
  `<ul><!--herb-slot:0:collection-->` +
  `<!--herb-item:0:1--><li><span data-herb-slot="2:child">0</span></li><!--/herb-item:0-->` +
  `<!--/herb-slot:0--></ul>` +
  `<template data-herb-region="${FILE}:eeeeeeee">` +
  `<!--herb-branch:0:item--><!--herb-item:0:--><li><span data-herb-slot="2:child"></span></li><!--/herb-item:0-->` +
  `</template>` +
  `<!--/herb-region:${FILE}-->`

const MANIFEST = {
  state: {},
  states: {
    [FILE]: {
      version: "eeeeeeee",
      declarations: [{ name: "count", kind: "integer", default: "0", scope: "region" }],
      reads: { count: [2] },
      conditionals: {},
    },
  },
}

let slots: SlotIndex
let state: SlotState

function textOf(key: string): string {
  const item = slots.regionsFor(FILE)[0].slots.get(0)!.items.get(key)!

  return slots.rangeFor(item.slots.get(2)!).toString()
}

beforeEach(() => {
  document.body.innerHTML = PAGE + `<template data-herb-dependencies>${JSON.stringify(MANIFEST)}</template>`

  slots = new SlotIndex()
  slots.scan(document.body)

  state = new SlotState(slots, {
    persist: "none",
    transport: () => {
      throw new Error("a declared state must never reach the transport")
    },
  })

  state.adopt()
})

describe("a region state read inside a collection item", () => {
  test("a row added after the write renders the current value, not the default", () => {
    const region = slots.regionsFor(FILE)[0]
    const collection = region.slots.get(0)!

    state.setState({ count: 3 }, { scope: { region, item: null } })

    expect(textOf("1")).toBe("3")

    slots.addItem(collection, "2")

    expect(textOf("2")).toBe("3")
  })

  test("the server cannot write its default over the value the client owns", () => {
    const region = slots.regionsFor(FILE)[0]
    const collection = region.slots.get(0)!

    state.setState({ count: 3 }, { scope: { region, item: null } })

    slots.addItem(collection, "2")

    slots.apply({
      template: FILE,
      version: "eeeeeeee",
      occurrence: 0,
      slots: { 0: { items: { 1: { 2: "0" }, 2: { 2: "0" } } } },
    })

    expect(textOf("1")).toBe("3")
    expect(textOf("2")).toBe("3")
  })
})
