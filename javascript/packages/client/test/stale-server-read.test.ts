import { describe, test, expect, beforeEach } from "vitest"

import { Slots } from "../src/slots/slots"
import { State } from "../src/state/state"

const FILE = "app/views/cascade/show.html.erb"
const VERSION = "1f2e3d4c"

const MANIFEST = {
  state: {},
  states: {
    [FILE]: {
      version: VERSION,
      declarations: [
        { name: "country", kind: "string", default: '""', derived: null, scope: "region", value: "CH" },
        { name: "state", kind: "string", default: '""', derived: null, scope: "region", value: "" },
      ],
      reads: {},
      conditionals: {
        0: { arms: [{ branch: 0, condition: ["state", null, "present"] }], else: 1 },
      },
      presence: {},
      computed: {},
      server: {
        reads: {
          country: [{ index: 1, node_path: [0] }],
          state: [{ index: 1, node_path: [0] }],
        },
        branches: {
          0: [{ index: 1, node_path: [0] }],
        },
      },
    },
  },
}

const PAGE =
  `<!--herb-region:${FILE}:${VERSION}:0-->` +
  `<div><!--herb-slot:0:conditional--><!--/herb-slot:0--></div>` +
  `<!--/herb-region:${FILE}-->` +
  `<template data-herb-region="${FILE}:${VERSION}">` +
  `<!--herb-branch:0:0--><p id="cities"><!--herb-slot:1--><!--/herb-slot:1--></p>` +
  `<!--herb-branch:0:1--><p id="waiting">loading</p>` +
  `</template>` +
  `<template data-herb-dependencies>${JSON.stringify(MANIFEST)}</template>`

let slots: Slots
let state: State

function shown(): string {
  const slot = slots.slot(FILE, 1)

  return slot ? slots.rangeOf(slot).toString() : "<not placed>"
}

beforeEach(() => {
  document.body.innerHTML = PAGE

  slots = new Slots()
  slots.scan(document.body)

  state = new State(slots, {})
  state.adopt()
})

describe("a server-read slot inside a conditional the same state drives", () => {
  test("does not resurrect a captured value after the read's state changed", () => {
    state.setState({ state: "BS" })

    expect(slots.slot(FILE, 0)?.branch).toBe(0)

    slots.apply({ template: FILE, version: VERSION, occurrence: 0, slots: { 0: { branch: 0, slots: { 1: "Basel and Riehen" } } } })

    expect(shown()).toBe("Basel and Riehen")

    state.setState({ state: "" })

    expect(slots.slot(FILE, 0)?.branch).toBe(1)

    state.setState({ state: "GE" })

    expect(slots.slot(FILE, 0)?.branch).toBe(0)
    expect(shown()).toBe("")
  })

  test("does not resurrect a captured value after another read changed while hidden", () => {
    state.setState({ state: "BS" })
    slots.apply({ template: FILE, version: VERSION, occurrence: 0, slots: { 0: { branch: 0, slots: { 1: "Basel and Riehen" } } } })

    state.setState({ country: "DE", state: "" })

    expect(slots.slot(FILE, 0)?.branch).toBe(1)

    state.setState({ state: "BY" })

    expect(slots.slot(FILE, 0)?.branch).toBe(0)
    expect(shown()).toBe("")
  })
})

const NESTED_FILE = "app/views/nested/show.html.erb"
const NESTED_VERSION = "5a6b7c8d"

const NESTED_MANIFEST = {
  state: {},
  states: {
    [NESTED_FILE]: {
      version: NESTED_VERSION,
      declarations: [
        { name: "country", kind: "string", default: '""', derived: null, scope: "region", value: "CH" },
        { name: "state", kind: "string", default: '""', derived: null, scope: "region", value: "" },
      ],
      reads: {},
      conditionals: {
        0: { arms: [{ branch: 0, condition: ["state", null, "present"] }], else: null },
      },
      presence: {},
      computed: {},
      server: {
        reads: {
          country: [{ index: 1, node_path: [0] }],
          state: [{ index: 1, node_path: [0] }],
        },
        branches: {
          0: [{ index: 1, node_path: [0] }],
        },
      },
      fragments: {
        2: { fallback: 1, reads: [1] },
      },
    },
  },
}

const NESTED_PAGE =
  `<!--herb-region:${NESTED_FILE}:${NESTED_VERSION}:0-->` +
  `<div><!--herb-slot:0:conditional--><!--/herb-slot:0--></div>` +
  `<!--/herb-region:${NESTED_FILE}-->` +
  `<template data-herb-region="${NESTED_FILE}:${NESTED_VERSION}">` +
  `<!--herb-branch:0:0--><section><!--herb-slot:2:conditional--><!--/herb-slot:2--></section>` +
  `<!--herb-branch:2:0--><p id="cities"><!--herb-slot:1--><!--/herb-slot:1--></p>` +
  `<!--herb-branch:2:1--><p id="waiting">loading</p>` +
  `</template>` +
  `<template data-herb-dependencies>${JSON.stringify(NESTED_MANIFEST)}</template>`

describe("a server-read slot nested in a fragment conditional inside the driven branch", () => {
  beforeEach(() => {
    document.body.innerHTML = NESTED_PAGE

    slots = new Slots()
    slots.scan(document.body)

    state = new State(slots, {})
    state.adopt()
  })

  function nestedShown(): string {
    const slot = slots.slot(NESTED_FILE, 1)

    return slot ? slots.rangeOf(slot).toString() : "<not placed>"
  }

  test("does not resurrect the nested value through the outer branch's stash", () => {
    state.setState({ state: "BS" })

    expect(slots.slot(NESTED_FILE, 0)?.branch).toBe(0)

    slots.apply({
      template: NESTED_FILE,
      version: NESTED_VERSION,
      occurrence: 0,
      slots: { 2: { branch: 0, slots: { 1: "Basel and Riehen" } } },
    })

    expect(nestedShown()).toBe("Basel and Riehen")

    state.setState({ state: "" })

    expect(slots.slot(NESTED_FILE, 0)?.branch).toBeNull()

    state.setState({ state: "GE" })

    expect(slots.slot(NESTED_FILE, 0)?.branch).toBe(0)
    expect(nestedShown()).not.toContain("Basel")
  })
})
