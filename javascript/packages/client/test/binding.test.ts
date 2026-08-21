import { describe, test, expect, beforeEach, afterEach } from "vitest"
import { SlotIndex } from "../src/slot-index"
import { SlotState } from "../src/state"

const FILE = "app/views/page/form.html.erb"

const PAGE =
  `<!--herb-region:${FILE}:aaaaaaaa:0-->` +
  `<input id="draft" value="" data-herb-slot="0:attribute:value">` +
  `<input id="agree" type="checkbox" data-herb-slot="1:attribute:checked">` +
  `<p><!--herb-slot:2--><!--/herb-slot:2--></p>` +
  `<div><!--herb-slot:3:conditional--><!--herb-branch:3:1-->unagreed<!--/herb-slot:3--></div>` +
  `<template data-herb-region="${FILE}:aaaaaaaa"><!--herb-branch:3:0-->agreed<!--herb-branch:3:1-->unagreed</template>` +
  `<!--/herb-region:${FILE}-->` +
  `<template data-herb-dependencies>${JSON.stringify({
    state: {},
    states: {
      [FILE]: {
        version: "aaaaaaaa",
        declarations: [
          { name: "draft", kind: "string", default: '""', scope: "region" },
          { name: "agreed", kind: "boolean", default: "false", scope: "region" },
        ],
        reads: { draft: [0, 2], agreed: [1] },
        bound: { draft: [0], agreed: [1] },
        conditionals: { 3: { arms: [["agreed", null, 0]], else: 1 } },
      },
    },
  })}</template>`

let slots: SlotIndex
let state: SlotState

beforeEach(() => {
  document.body.innerHTML = PAGE

  slots = new SlotIndex()
  slots.scan(document.body)

  state = new SlotState(slots, { persist: "none" })
  state.adopt()
  state.observe()
})

afterEach(() => state.disconnect())

describe("bound slots", () => {
  test("typing into a bound input sets the state and fans out", () => {
    const input = document.querySelector<HTMLInputElement>("#draft")!

    input.value = "hello"
    input.dispatchEvent(new Event("input", { bubbles: true }))

    expect(state.getState("draft")).toBe("hello")
    expect(document.querySelector("p")?.textContent).toContain("hello")
  })

  test("the write-back does not re-enter the handler", () => {
    const input = document.querySelector<HTMLInputElement>("#draft")!
    let events = 0

    document.addEventListener("input", () => (events += 1))

    input.value = "once"
    input.dispatchEvent(new Event("input", { bubbles: true }))

    expect(events).toBe(1)
    expect(input.getAttribute("value")).toBe("once")
  })

  test("a checkbox binds its boolean and flips the branch it drives", () => {
    const checkbox = document.querySelector<HTMLInputElement>("#agree")!

    checkbox.checked = true
    checkbox.dispatchEvent(new Event("change", { bubbles: true }))

    expect(state.getState("agreed")).toBe(true)
    expect(document.querySelector("div")?.textContent).toContain("agreed")
  })

  test("an unbound control writes nothing", () => {
    const loose = document.createElement("input")

    document.body.append(loose)
    loose.value = "stray"
    loose.dispatchEvent(new Event("input", { bubbles: true }))

    expect(state.getState("draft")).toBe("")
  })
})
