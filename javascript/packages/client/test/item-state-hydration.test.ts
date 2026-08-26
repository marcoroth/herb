import { describe, test, expect, beforeEach } from "vitest"

import { Slots } from "../src/slots/slots"
import { State } from "../src/state/state"

import type { PayloadSlots } from "../src/types"

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

let slots: Slots
let state: State

function textOf(key: string): string {
  const item = slots.regionsFor(FILE)[0].slots.get(0)!.items.get(key)!

  return slots.rangeOf(item.slots.get(2)!).toString()
}

beforeEach(() => {
  document.body.innerHTML = PAGE + `<template data-herb-dependencies>${JSON.stringify(MANIFEST)}</template>`

  slots = new Slots()
  slots.scan(document.body)

  state = new State(slots, {
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

  test("a row the payload built holds the value the client owns", () => {
    const region = slots.regionsFor(FILE)[0]

    state.setState({ count: 3 }, { scope: { region, item: null } })

    slots.apply({
      template: FILE,
      version: "eeeeeeee",
      occurrence: 0,
      slots: { 0: { items: { 1: { 2: "0" }, 2: { 2: "0" } } } },
    })

    expect(textOf("2")).toBe("3")
  })
})

const BRANCH_FILE = "app/views/chat/edit.html.erb"

const BRANCH_PAGE =
  `<!--herb-region:${BRANCH_FILE}:ffffffff:0-->` +
  `<div><!--herb-slot:0:conditional--><!--/herb-slot:0--></div>` +
  `<template data-herb-region="${BRANCH_FILE}:ffffffff">` +
  `<!--herb-branch:0:0--><textarea data-herb-slot="1:raw_text"></textarea>` +
  `</template>` +
  `<!--/herb-region:${BRANCH_FILE}-->`

const BRANCH_MANIFEST = {
  state: {},
  states: {
    [BRANCH_FILE]: {
      version: "ffffffff",
      declarations: [
        { name: "editing", kind: "boolean", default: "false", scope: "region" },
        { name: "body_draft", kind: "string", default: '""', scope: "region" },
      ],
      reads: { body_draft: [1] },
      conditionals: { 0: { arms: [["editing", null, 0]], else: null } },
    },
  },
}

describe("a state read inside a branch that was never on the page", () => {
  test("materializing the branch fills it with the value the client holds", () => {
    document.body.innerHTML = BRANCH_PAGE + `<template data-herb-dependencies>${JSON.stringify(BRANCH_MANIFEST)}</template>`

    const branchSlots = new Slots()

    branchSlots.scan(document.body)

    const branchState = new State(branchSlots, {
      persist: "none",
      transport: () => {
        throw new Error("a declared state must never reach the transport")
      },
    })

    branchState.adopt()
    branchState.setState({ body_draft: "seeded body" })

    expect(document.querySelector("textarea")).toBeNull()

    branchState.setState({ editing: true })

    expect(document.querySelector("textarea")?.textContent).toBe("seeded body")
  })
})

const SEEDED_FILE = "app/views/chat/seeded.html.erb"

const SEEDED_PAGE =
  `<!--herb-region:${SEEDED_FILE}:11111111:0-->` +
  `<ul><!--herb-slot:0:collection--><!--/herb-slot:0--></ul>` +
  `<template data-herb-region="${SEEDED_FILE}:11111111">` +
  `<!--herb-branch:0:item--><!--herb-item:0:--><li><span data-herb-slot="2:child"></span></li><!--/herb-item:0-->` +
  `</template>` +
  `<!--/herb-region:${SEEDED_FILE}-->` +
  `<template data-herb-dependencies>${JSON.stringify({
    state: {},
    states: {
      [SEEDED_FILE]: {
        version: "11111111",
        declarations: [{ name: "body_draft", kind: "seeded", default: "message.body", scope: 0 }],
        reads: { body_draft: [2] },
        conditionals: {},
      },
    },
  })}</template>`

describe("a seeded item state on a row the client built", () => {
  test("takes its value from the response, since the row carries no seeds comment", () => {
    document.body.innerHTML = SEEDED_PAGE

    const seededSlots = new Slots()

    seededSlots.scan(document.body)

    const seededState = new State(seededSlots, {
      persist: "none",
      transport: () => {
        throw new Error("a declared state must never reach the transport")
      },
    })

    seededState.adopt()

    seededSlots.apply({
      template: SEEDED_FILE,
      version: "11111111",
      occurrence: 0,
      slots: { 0: { items: { 7: { 2: "hello", seeds: { body_draft: "hello" } } } } } as unknown as PayloadSlots,
    })

    const region = seededSlots.regionsFor(SEEDED_FILE)[0]
    const item = region.slots.get(0)!.items.get("7")!

    expect(item.seeds).toEqual({ body_draft: "hello" })
    expect(seededState.getState("body_draft", { scope: { region, item } })).toBe("hello")
  })
})

const NESTED_FILE = "app/views/chat/toolbar.html.erb"

const NESTED_PAGE =
  `<!--herb-region:${NESTED_FILE}:22222222:0-->` +
  `<div><!--herb-slot:0:conditional--><!--/herb-slot:0--></div>` +
  `<template data-herb-region="${NESTED_FILE}:22222222">` +
  `<!--herb-branch:0:0-->` +
  `<span><!--herb-slot:1:conditional--><!--/herb-slot:1--></span>` +
  `<button data-herb-slot="2:boolean_attribute:disabled">Delete</button>` +
  `<!--herb-branch:1:0-->Delete message` +
  `<!--herb-branch:1:1-->Delete selected` +
  `</template>` +
  `<!--/herb-region:${NESTED_FILE}-->` +
  `<template data-herb-dependencies>${JSON.stringify({
    state: {},
    states: {
      [NESTED_FILE]: {
        version: "22222222",
        declarations: [
          { name: "open", kind: "boolean", default: "false", scope: "region" },
          { name: "count", kind: "integer", default: "0", scope: "region" },
        ],
        reads: {},
        conditionals: {
          0: { arms: [["open", null, 0]], else: null },
          1: { arms: [["count", "1", 0]], else: 1 },
        },
        presence: { 2: ["count", "0"] },
      },
    },
  })}</template>`

describe("markup that materializes with a conditional and a boolean attribute inside it", () => {
  test("settles both from the states in scope", () => {
    document.body.innerHTML = NESTED_PAGE

    const nestedSlots = new Slots()

    nestedSlots.scan(document.body)

    const nestedState = new State(nestedSlots, {
      persist: "none",
      transport: () => {
        throw new Error("a declared state must never reach the transport")
      },
    })

    nestedState.adopt()
    nestedState.setState({ open: true })

    expect(document.querySelector("span")?.textContent).toBe("Delete selected")
    expect(document.querySelector("button")?.hasAttribute("disabled")).toBe(true)

    nestedState.setState({ count: 1 })

    expect(document.querySelector("span")?.textContent).toBe("Delete message")
    expect(document.querySelector("button")?.hasAttribute("disabled")).toBe(false)
  })
})
