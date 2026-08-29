import { describe, test, expect, beforeEach, afterEach } from "vitest"

import { Actions } from "../src/actions/actions"
import { Slots } from "../src/slots/slots"
import { State } from "../src/state/state"

const FILE = "app/views/chat/show.html.erb"
const VERSION = "8cb7a499"

const MANIFEST = {
  state: {},
  states: {
    [FILE]: {
      version: VERSION,
      declarations: [
        { name: "draft", kind: "string", default: '""', derived: null, scope: "region", value: "" },
      ],
      reads: { draft: [1] },
      conditionals: {
        0: { arms: [{ branch: 0, condition: ["draft", { value: "hello" }] }], else: null },
      },
      presence: {},
    },
  },
}

const PAGE =
  `<!--herb-region:${FILE}:${VERSION}:0-->\n` +
  `<input data-herb-set="input->draft=$value">\n` +
  `<!--herb-slot:0:conditional--><!--/herb-slot:0-->\n` +
  `<!--/herb-region:${FILE}--><template data-herb-region="${FILE}:${VERSION}"><!--herb-branch:0:0-->\n` +
  `  <!--herb-slot:1--><!--/herb-slot:1-->\n` +
  `</template>` +
  `<template data-herb-dependencies>${JSON.stringify(MANIFEST)}</template>`

let slots: Slots
let state: State
let actions: Actions

function input(): HTMLInputElement {
  return document.querySelector("input")!
}

function type(text: string): void {
  input().value = text
  input().dispatchEvent(new Event("input", { bubbles: true }))
}

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

  actions = new Actions(state)
  actions.start(document.body)
})

afterEach(() => actions.stop())

describe("a value slot inside a branch driven by the same state", () => {
  test("shows the current value the first time the branch is taken", () => {
    type("hell")

    expect(slots.slot(FILE, 0)?.branch).toBeNull()

    type("hello")

    expect(slots.slot(FILE, 0)?.branch).toBe(0)
    expect(shown()).toBe("hello")
  })

  test("shows the current value when the branch is taken again", () => {
    type("hello")

    expect(shown()).toBe("hello")

    type("hell")

    expect(slots.slot(FILE, 0)?.branch).toBeNull()

    type("hello")

    expect(slots.slot(FILE, 0)?.branch).toBe(0)
    expect(shown()).toBe("hello")
  })

  test("shows the current value when the state changes while the branch is hidden", () => {
    type("hello")
    type("hell")
    type("hello!")
    type("hello")

    expect(shown()).toBe("hello")
  })
})
