import { describe, test, expect, beforeEach } from "vitest"

import { Slots } from "../src/slots/slots"
import { State } from "../src/state/state"

const FILE = "app/views/chat/show.html.erb"
const VERSION = "aaaaaaaa"

const MANIFEST = {
  state: {},
  states: {
    [FILE]: {
      version: VERSION,
      declarations: [
        { name: "draft", kind: "string", default: '""', value: "", scope: "region" },
        { name: "count", kind: "integer", default: "0", value: 0, scope: "region" },
      ],
      reads: { draft: [1, 2, 3], count: [4] },
      conditionals: {
        0: { arms: [{ branch: 0, condition: ["draft", { value: "hello" }] }], else: null },
      },
      presence: { 3: ["draft", null, "blank"] },
      computed: { 1: ["draft", { value: "hello" }], 4: ["count", { value: 1 }] },
    },
  },
}

const PAGE =
  `<!--herb-region:${FILE}:${VERSION}:0-->` +
  `<div><!--herb-slot:0:conditional--><!--/herb-slot:0--></div>` +
  `<p><!--herb-slot:1-->false<!--/herb-slot:1--></p>` +
  `<button data-herb-slot="3:boolean_attribute:disabled" disabled>Send</button>` +
  `<em><!--herb-slot:4-->false<!--/herb-slot:4--></em>` +
  `<!--/herb-region:${FILE}-->` +
  `<template data-herb-region="${FILE}:${VERSION}">` +
  `<!--herb-branch:0:0-->\n  <!--herb-slot:2--><!--/herb-slot:2-->\n` +
  `</template>` +
  `<template data-herb-dependencies>${JSON.stringify(MANIFEST)}</template>`

let slots: Slots
let state: State

beforeEach(() => {
  document.body.innerHTML = PAGE

  slots = new Slots()
  slots.scan(document.body)

  state = new State(slots, {})
  state.adopt()
})

function text(index: number): string {
  return slots.rangeOf(slots.slot(FILE, index)!).toString()
}

describe("a slot whose value the compiler resolved into a condition", () => {
  test("prints the condition's answer instead of the state", () => {
    expect(text(1)).toBe("false")

    state.setState({ draft: "hello" })

    expect(text(1)).toBe("true")

    state.setState({ draft: "hell" })

    expect(text(1)).toBe("false")
  })

  test("prints a count comparison the same way", () => {
    state.setState({ count: 1 })

    expect(text(4)).toBe("true")

    state.setState({ count: 2 })

    expect(text(4)).toBe("false")
  })

  test("leaves the state's own text alone", () => {
    state.setState({ draft: "hello" })

    expect(text(2)).toBe("hello")
  })
})

describe("a boolean attribute the compiler resolved into a blank check", () => {
  test("turns off once the state holds more than whitespace", () => {
    const button = document.querySelector("button")!

    expect(button.hasAttribute("disabled")).toBe(true)

    state.setState({ draft: "   " })

    expect(button.hasAttribute("disabled")).toBe(true)

    state.setState({ draft: "hi" })

    expect(button.hasAttribute("disabled")).toBe(false)
  })
})

describe("a value slot inside a branch that was never in the document", () => {
  test("shows the value the state holds now, not the one it was parked with", () => {
    state.setState({ draft: "hell" })
    state.setState({ draft: "hello" })

    expect(slots.slot(FILE, 0)?.branch).toBe(0)
    expect(text(2)).toBe("hello")
  })

})
