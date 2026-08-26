import { describe, test, expect, beforeEach, afterEach } from "vitest"
import { stateFor } from "../src/state/for-element"
import { useState } from "../src/stimulus"

import { Runtime } from "../src/runtime"

const FILE = "app/views/page/card.html.erb"

const PAGE =
  `<!--herb-region:${FILE}:aaaaaaaa:0-->` +
  `<section><div><!--herb-slot:0:conditional--><!--herb-branch:0:1-->closed<!--/herb-slot:0--></div>` +
  `<button id="go">Details</button></section>` +
  `<template data-herb-region="${FILE}:aaaaaaaa"><!--herb-branch:0:0-->open<!--herb-branch:0:1-->closed</template>` +
  `<!--/herb-region:${FILE}-->` +
  `<template data-herb-dependencies>${JSON.stringify({
    state: {},
    states: {
      [FILE]: {
        version: "aaaaaaaa",
        declarations: [{ name: "expanded", kind: "boolean", default: "false", scope: "region" }],
        reads: {},
        conditionals: { 0: { arms: [["expanded", null, 0]], else: 1 } },
      },
    },
  })}</template>`

let runtime: Runtime

beforeEach(() => {
  document.body.innerHTML = PAGE
  runtime = Runtime.start({ state: { persist: "none" } })
  runtime.slots.scan(document.body)
  runtime.state.adopt()
})

afterEach(() => runtime.stop())

describe("stateFor and useState", () => {
  test("stateFor binds to the enclosing scope", () => {
    const state = stateFor(document.querySelector("#go")!)

    expect(state.get("expanded")).toBe(false)
    expect(state.toggle("expanded")).toBe(true)
    expect(document.querySelector("div")?.textContent).toContain("open")
  })

  test("useState wires <name>Changed and tears down on disconnect", () => {
    const seen: unknown[] = []
    const host = {
      element: document.querySelector("#go")!,
      expandedChanged(value: unknown, previous: unknown) {
        seen.push([value, previous])
      },
      disconnect() {},
    }

    const state = useState(host)

    state.set({ expanded: true })
    expect(seen).toEqual([[true, false]])

    host.disconnect()
    state.set({ expanded: false })
    expect(seen).toEqual([[true, false]])
  })

  test("useState also hands the host the outbox", () => {
    const host = {
      element: document.querySelector("#go")!,
      outbox: undefined,
      slots: undefined,
      disconnect() {},
    }

    const state = useState(host)

    expect(host.outbox).toBe(runtime.outbox)
    expect(host.slots).toBe(runtime.slots)
    expect(state.get("expanded")).toBe(false)
  })
})
