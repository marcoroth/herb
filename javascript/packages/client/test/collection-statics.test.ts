import { describe, test, expect, beforeEach } from "vitest"

import { Slots } from "../src/slots/slots"
import { State } from "../src/state/state"

const FILE = "app/views/dashboard/show.html.erb"
const VERSION = "9d8c7b6a"

const PAGE =
  `<!--herb-region:${FILE}:${VERSION}:0-->` +
  `<section><!--herb-slot:0:conditional--><!--/herb-slot:0--></section>` +
  `<!--/herb-region:${FILE}-->`

const BRANCH_STATICS =
  `<!--herb-branch:0:0--><ul><!--herb-slot:1:collection--><!--/herb-slot:1--></ul>`

const ITEM_STATICS =
  `<!--herb-branch:1:item--><!--herb-item:1:--><li herb-key="" data-herb-slot="2:attribute:herb-key"><span data-herb-slot="3:child"></span></li><!--/herb-item:1-->`

let slots: Slots

beforeEach(() => {
  document.body.innerHTML = PAGE

  slots = new Slots()
  slots.scan(document.body)
})

describe("a payload carrying a collection's item statics", () => {
  test("builds the items without any parked material", () => {
    const report = slots.apply({
      template: FILE,
      version: VERSION,
      occurrence: 0,
      slots: {
        0: {
          branch: 0,
          statics: BRANCH_STATICS,
          slots: {
            1: {
              items: {
                Europe: { 2: "Europe", 3: "Europe" },
                Asia: { 2: "Asia", 3: "Asia" },
              },
              order: ["Europe", "Asia"],
              statics: ITEM_STATICS,
            },
          },
        },
      },
    })

    expect(report.deferred).toEqual([])
    expect(document.querySelectorAll("li").length).toBe(2)
    expect(document.body.textContent).toContain("Europe")
    expect(document.body.textContent).toContain("Asia")
  })
})

const DEFERRED_FILE = "app/views/deferred/show.html.erb"
const DEFERRED_VERSION = "8e7f6a5b"

const DEFERRED_MANIFEST = {
  state: {},
  states: {
    [DEFERRED_FILE]: {
      version: DEFERRED_VERSION,
      declarations: [
        { name: "_herb_block_0", kind: "boolean", default: "false", derived: null, scope: "region", value: false, internal: true },
      ],
      reads: {},
      conditionals: {
        0: { arms: [{ branch: 0, condition: ["_herb_block_0", null] }], else: 1 },
      },
      presence: {},
      computed: {},
    },
  },
}

const DEFERRED_PAGE =
  `<!--herb-region:${DEFERRED_FILE}:${DEFERRED_VERSION}:0-->` +
  `<section><!--herb-slot:0:conditional--><!--herb-branch:0:1--><p id="waiting">loading</p><!--/herb-slot:0--></section>` +
  `<!--/herb-region:${DEFERRED_FILE}-->` +
  `<template data-herb-region="${DEFERRED_FILE}:${DEFERRED_VERSION}"><!--herb-branch:0:1--><p id="waiting">loading</p></template>` +
  `<template data-herb-dependencies>${JSON.stringify(DEFERRED_MANIFEST)}</template>`

describe("a deferred block's payload holding a collection", () => {
  let state: State

  beforeEach(() => {
    document.body.innerHTML = DEFERRED_PAGE

    slots = new Slots()
    slots.scan(document.body)

    state = new State(slots, {})
    state.adopt()
  })

  test("builds the items when the payload's material lets the state switch over", () => {
    expect(slots.slot(DEFERRED_FILE, 0)?.branch).toBe(1)

    state.setState({ _herb_block_0: true })

    expect(slots.slot(DEFERRED_FILE, 0)?.claimed).toBe(true)

    const report = slots.apply({
      template: DEFERRED_FILE,
      version: DEFERRED_VERSION,
      occurrence: 0,
      slots: {
        0: {
          branch: 0,
          statics: `<!--herb-branch:0:0--><ul><!--herb-slot:1:collection--><!--/herb-slot:1--></ul>`,
          slots: {
            1: {
              items: {
                Europe: { 2: "Europe", 3: "Europe" },
                Asia: { 2: "Asia", 3: "Asia" },
              },
              order: ["Europe", "Asia"],
              statics: `<!--herb-branch:1:item--><!--herb-item:1:--><li herb-key="" data-herb-slot="2:attribute:herb-key"><span data-herb-slot="3:child"></span></li><!--/herb-item:1-->`,
            },
          },
        },
      },
    })

    expect(report.deferred).toEqual([])
    expect(slots.slot(DEFERRED_FILE, 0)?.branch).toBe(0)
    expect(document.querySelectorAll("li").length).toBe(2)
    expect(document.body.textContent).toContain("Asia")
  })
})
