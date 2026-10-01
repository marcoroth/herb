import { describe, test, expect, beforeEach } from "vitest"

import { Slots } from "../src/slots/slots"
import { State } from "../src/state/state"

const FILE = "app/views/page/drawer.html.erb"

const PAGE =
  `<!--herb-region:${FILE}:aaaaaaaa:0-->` +
  `<div id="host"><!--herb-slot:0:conditional--><!--herb-branch:0:0--><aside id="drawer">opened</aside><!--/herb-slot:0--></div>` +
  `<template data-herb-region="${FILE}:aaaaaaaa">` +
  `<!--herb-branch:0:0--><aside id="drawer">opened</aside><!--herb-branch:0:1-->closed` +
  `</template>` +
  `<!--/herb-region:${FILE}-->` +
  `<template data-herb-dependencies>${JSON.stringify({
    state: {},
    states: {
      [FILE]: {
        version: "aaaaaaaa",
        declarations: [{ name: "open", kind: "boolean", default: "true", value: true, scope: "region" }],
        reads: {},
        conditionals: { 0: { arms: [["open", null, 0]], else: 1 } },
      },
    },
  })}</template>`

let slots: Slots
let state: State

function host(): string {
  return document.querySelector("#host")!.textContent ?? ""
}

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

beforeEach(() => {
  document.body.innerHTML = PAGE

  slots = new Slots()
  slots.scan(document.body)

  state = new State(slots, { refetch: "off" })
  state.adopt()
})

describe("holding a branch", () => {
  test("a hold keeps the branch on the page until it resolves", async () => {
    let release: () => void = () => {}
    const seen: Array<[number, number | null]> = []

    slots.subscribe({
      holdBranch: (slot, branch) => {
        seen.push([slot.index, branch])

        return new Promise<void>((resolve) => {
          release = resolve
        })
      },
    })

    state.setState({ open: false })

    expect(host()).toBe("opened")
    expect(seen).toEqual([[0, 1]])
    expect(document.querySelector("#drawer")).not.toBeNull()

    release()
    await flush()

    expect(host()).toBe("closed")
  })

  test("a state that flips back while held leaves the branch where it is", async () => {
    let release: () => void = () => {}

    slots.subscribe({
      holdBranch: () =>
        new Promise<void>((resolve) => {
          release = resolve
        }),
    })

    const drawer = document.querySelector("#drawer")

    state.setState({ open: false })
    state.setState({ open: true })

    release()
    await flush()

    expect(host()).toBe("opened")
    expect(document.querySelector("#drawer")).toBe(drawer)
  })

  test("a hold that rejects still lets the branch switch", async () => {
    slots.subscribe({ holdBranch: () => Promise.reject(new Error("animation cancelled")) })

    state.setState({ open: false })

    expect(host()).toBe("opened")

    await flush()

    expect(host()).toBe("closed")
  })

  test("a delegate that returns nothing does not delay the switch", () => {
    slots.subscribe({ holdBranch: () => undefined })

    state.setState({ open: false })

    expect(host()).toBe("closed")
  })

  test("a branch that does not change is not held", () => {
    const seen: number[] = []

    slots.subscribe({
      holdBranch: (slot) => {
        seen.push(slot.index)
      },
    })

    state.setState({ open: true })

    expect(seen).toEqual([])
  })
})
