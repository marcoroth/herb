import { describe, test, expect, beforeEach } from "vitest"

import { Slots } from "../src/slots/slots"
import { State } from "../src/state/state"

const FILE = "app/views/chat/show.html.erb"

const PAGE =
  `<!--herb-region:${FILE}:eeeeeeee:0-->` +
  `<ul><!--herb-slot:0:collection-->` +
  `<!--herb-item:0:a--><li data-herb-slot="3:attribute:data-starred" data-starred="false">a</li><!--/herb-item:0-->` +
  `<!--herb-item:0:b--><li data-herb-slot="3:attribute:data-starred" data-starred="false">b</li><!--/herb-item:0-->` +
  `<!--/herb-slot:0--></ul>` +
  `<span data-herb-slot="5:child">0</span>` +
  `<!--/herb-region:${FILE}-->`

const MANIFEST = {
  state: {},
  states: {
    [FILE]: {
      version: "eeeeeeee",
      declarations: [
        { name: "count", kind: "integer", default: "0", scope: "region" },
        { name: "starred", kind: "boolean", default: "false", scope: 0 },
      ],
      reads: { count: [5], starred: [3] },
      conditionals: {},
    },
  },
}

let slots: Slots
let state: State

function starredOf(key: string): string | null {
  const item = slots.regionsFor(FILE)[0].slots.get(0)!.items.get(key)!
  const slot = item.slots.get(3)!
  const anchor = slot.anchor as { element?: Element }

  return anchor.element?.getAttribute("data-starred") ?? null
}

beforeEach(() => {
  document.body.innerHTML = PAGE + `<template data-herb-dependencies>${JSON.stringify(MANIFEST)}</template>`

  slots = new Slots()
  slots.scan(document.body)

  state = new State(slots, {
    transport: () => {
      throw new Error("a declared state must never reach the transport")
    },
  })

  state.adopt()
})

describe("resettling a region with item state", () => {
  test("keeps each item's own value instead of stamping the region resolution across items", () => {
    const region = slots.regionsFor(FILE)[0]
    const item = region.slots.get(0)!.items.get("a")!

    state.setState({ starred: true }, { scope: { region, item } })

    expect(starredOf("a")).toBe("true")

    state.resettle(region)

    expect(starredOf("a")).toBe("true")
    expect(starredOf("b")).toBe("false")
  })
})
