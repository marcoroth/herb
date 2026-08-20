import { describe, test, expect, beforeEach, vi } from "vitest"
import { SlotIndex } from "../src/slot-index"
import { SlotState, STATE_EVENT } from "../src/state"

const FILE = "app/views/page/chat.html.erb"

function regionMarkup(occurrence: number): string {
  return (
    `<!--herb-region:${FILE}:aaaaaaaa:${occurrence}-->` +
    `<div><!--herb-slot:0:conditional--><!--herb-branch:0:2-->Sent<!--/herb-slot:0--></div>` +
    `<p><!--herb-slot:1-->0<!--/herb-slot:1--></p>` +
    `<ul><!--herb-slot:2:collection-->` +
    `<!--herb-item:2:a--><li id="a" data-herb-slot="3:attribute:id"><span data-herb-slot="4:conditional"><!--herb-branch:4:1-->plain</span></li><!--/herb-item:2-->` +
    `<!--herb-item:2:b--><li id="b" data-herb-slot="3:attribute:id"><span data-herb-slot="4:conditional"><!--herb-branch:4:1-->plain</span></li><!--/herb-item:2-->` +
    `<!--/herb-slot:2--></ul>` +
    `<template data-herb-region="${FILE}:aaaaaaaa">` +
    `<!--herb-branch:0:0-->Sending…<!--herb-branch:0:1-->Not sent<!--herb-branch:0:2-->Sent` +
    `<!--herb-branch:4:0-->starred<!--herb-branch:4:1-->plain` +
    `</template>` +
    `<!--/herb-region:${FILE}-->`
  )
}

const MANIFEST = {
  state: {},
  states: {
    [FILE]: {
      version: "aaaaaaaa",
      declarations: [
        { name: "pending", kind: "boolean", default: "false", scope: "region" },
        { name: "failed", kind: "boolean", default: "false", scope: "region" },
        { name: "attempts", kind: "integer", default: "0", scope: "region" },
        { name: "starred", kind: "boolean", default: "false", scope: 2 },
      ],
      reads: { attempts: [1] },
      conditionals: {
        0: { arms: [["pending", null, 0], ["failed", null, 1]], else: 2 },
        4: { arms: [["starred", null, 0]], else: 1 },
      },
    },
  },
}

function dependencies(): string {
  return `<template data-herb-dependencies>${JSON.stringify(MANIFEST)}</template>`
}

let slots: SlotIndex
let state: SlotState

function boot(markup: string): void {
  document.body.innerHTML = markup + dependencies()

  slots = new SlotIndex()
  slots.scan(document.body)

  state = new SlotState(slots, {
    persist: "none",
    transport: () => {
      throw new Error("a declared state must never reach the transport")
    },
  })
  state.adopt()
}

beforeEach(() => boot(regionMarkup(0)))

describe("declared state", () => {
  test("a rekeyed item keeps its scoped state", () => {
    const first = document.querySelector("#a")!
    const scope = state.scopeFor(first, "starred")!

    expect(state.setState({ starred: true }, { scope })).toBe(true)
    expect(first.textContent).toContain("starred")

    const collection = slots.slot(FILE, 2)!

    expect(slots.rekeyItem(collection, "a", "message_9")).toBe(true)

    const rekeyed = state.scopeFor(document.querySelector("#a")!, "starred")!

    expect(state.getState("starred", { scope: rekeyed })).toBe(true)
  })


  test("set flips a parked branch without any request", () => {
    expect(state.setState({ pending: true })).toBe(true)
    expect(document.querySelector("div")?.textContent).toContain("Sending…")

    expect(state.setState({ pending: false, failed: true })).toBe(true)
    expect(document.querySelector("div")?.textContent).toContain("Not sent")

    expect(state.setState({ failed: false })).toBe(true)
    expect(document.querySelector("div")?.textContent).toContain("Sent")
  })

  test("a value read is written with setText", () => {
    state.setState({ attempts: 3 })

    expect(document.querySelector("p")?.textContent).toContain("3")
    expect(state.getState("attempts")).toBe(3)
  })

  test("ruby truthiness, not JavaScript's", () => {
    const manifest = structuredClone(MANIFEST)

    manifest.states[FILE].conditionals[0] = { arms: [["attempts", null, 0]], else: 2 }
    document.body.innerHTML = regionMarkup(0) + `<template data-herb-dependencies>${JSON.stringify(manifest)}</template>`
    slots = new SlotIndex()
    slots.scan(document.body)
    state = new SlotState(slots, { persist: "none" })
    state.adopt()

    state.setState({ attempts: 0 })

    expect(document.querySelector("div")?.textContent).toContain("Sending…")
  })

  test("seeds from what the server rendered, and reset returns to it", () => {
    expect(state.getState("pending")).toBe(false)

    state.setState({ pending: true })
    expect(state.getState("pending")).toBe(true)

    state.reset("pending")
    expect(state.getState("pending")).toBe(false)
    expect(document.querySelector("div")?.textContent).toContain("Sent")
  })

  test("toggle refuses a non-boolean and increment refuses a non-integer", () => {
    expect(() => state.toggle("attempts")).toThrow(TypeError)
    expect(() => state.increment("pending")).toThrow(TypeError)

    expect(state.toggle("pending")).toBe(true)
    expect(state.getState("pending")).toBe(true)

    state.increment("attempts", { by: 2 })
    expect(state.getState("attempts")).toBe(2)
  })

  test("an item-scoped state moves one row and no other", () => {
    const first = document.querySelector("#a")!
    const scope = state.scopeFor(first, "starred")!

    expect(scope.item?.key).toBe("a")
    expect(state.setState({ starred: true }, { scope })).toBe(true)

    expect(document.querySelector("#a")?.textContent).toContain("starred")
    expect(document.querySelector("#b")?.textContent).toContain("plain")
  })

  test("get against two scopes returns two values", () => {
    const a = state.scopeFor(document.querySelector("#a")!, "starred")!
    const b = state.scopeFor(document.querySelector("#b")!, "starred")!

    state.setState({ starred: true }, { scope: a })

    expect(state.getState("starred", { scope: a })).toBe(true)
    expect(state.getState("starred", { scope: b })).toBe(false)
  })

  test("two renders of a template hold independent values", () => {
    document.body.innerHTML = regionMarkup(0) + regionMarkup(1) + dependencies()
    slots = new SlotIndex()
    slots.scan(document.body)
    state = new SlotState(slots, { persist: "none" })
    state.adopt()

    const regions = slots.regionsFor(FILE)
    const first = { region: regions[0], item: null }
    const second = { region: regions[1], item: null }

    state.setState({ pending: true }, { scope: first })

    expect(state.getState("pending", { scope: first })).toBe(true)
    expect(state.getState("pending", { scope: second })).toBe(false)

    const shown = [...document.querySelectorAll("div")].map((div) => div.textContent)

    expect(shown[0]).toContain("Sending…")
    expect(shown[1]).toContain("Sent")
  })

  test("a transition is one revert unit and announces each state", () => {
    const seen: string[] = []
    const off = state.on("pending", (value) => seen.push(`pending:${value}`))
    const offFailed = state.on("failed", (value) => seen.push(`failed:${value}`))

    state.setState({ pending: true, failed: false })

    expect(seen).toEqual(["pending:true", "failed:false"])

    off()
    offFailed()
  })

  test("a version mismatch declines rather than resolving stale arms", () => {
    document.body.innerHTML =
      regionMarkup(0).split("aaaaaaaa").join("bbbbbbbb") + dependencies()
    slots = new SlotIndex()
    slots.scan(document.body)
    state = new SlotState(slots, { persist: "none" })
    state.adopt()

    expect(state.setState({ pending: true })).toBe(false)
  })

  test("the transport is never called", () => {
    const transport = vi.fn()

    state = new SlotState(slots, { persist: "none", transport })
    state.adopt()
    state.setState({ pending: true })

    expect(transport).not.toHaveBeenCalled()
  })

  test("state change events carry the scope", () => {
    const details: unknown[] = []
    const handler = (event: Event): void => {
      details.push((event as CustomEvent).detail)
    }

    document.addEventListener(STATE_EVENT, handler)
    state.setState({ pending: true })
    document.removeEventListener(STATE_EVENT, handler)

    expect(details).toMatchObject([{ name: "pending", value: true, previous: false, file: FILE, occurrence: 0, key: null }])
  })
})
