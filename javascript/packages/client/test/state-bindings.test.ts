import { describe, test, expect, beforeEach, afterEach, vi } from "vitest"

import { Actions } from "../src/actions/actions"
import { Runtime } from "../src/runtime"
import { Slots } from "../src/slots/slots"
import { State } from "../src/state/state"
import { STATE_EVENT } from "../src/shared/events"

import type { StateChangeDetail } from "../src/state/types"

const PARENT = "app/views/overlays/show.html.erb"
const CHILD = "app/views/shared/_album_card.html.erb"
const PARENT_VERSION = "aaaa0001"
const CHILD_VERSION = "bbbb0002"

function manifest(file: string, version: string, states: object, bindings: object = {}) {
  return { file, identifier: file, version, names: {}, parts: {}, bindings, states: { version, presence: {}, computed: {}, ...states } }
}

const PARENT_STATES = {
  declarations: [{ name: "modal_open", kind: "boolean", default: "false", derived: null, scope: "region", value: false }],
  reads: { modal_open: [0] },
  conditionals: {},
}

const CHILD_STATES = {
  declarations: [
    { name: "open", kind: "boolean", default: "false", derived: null, scope: "region", value: false },
    { name: "label", kind: "string", default: '""', derived: null, scope: "region", value: "" },
  ],
  reads: { open: [0], label: [1] },
  conditionals: {},
}

const BINDINGS = { 1: { identifier: CHILD, partial: "shared/album_card", states: { open: "modal_open" } } }

function page(bindings: object): string {
  return (
    `<!--herb-region:${PARENT}:${PARENT_VERSION}:0-->` +
    `<button id="parent-toggle" data-herb-toggle="modal_open">toggle</button>` +
    `<p id="parent-text"><!--herb-slot:0--><!--/herb-slot:0--></p>` +
    `<div><!--herb-slot:1-->` +
    `<!--herb-region:${CHILD}:${CHILD_VERSION}:0-->` +
    `<span id="child-text"><!--herb-slot:0--><!--/herb-slot:0--></span>` +
    `<span id="child-label"><!--herb-slot:1--><!--/herb-slot:1--></span>` +
    `<button id="child-close" data-herb-set="open=false">close</button>` +
    `<button id="child-label-set" data-herb-set="label='hi'">label</button>` +
    `<!--/herb-region:${CHILD}-->` +
    `<!--/herb-slot:1--></div>` +
    `<!--/herb-region:${PARENT}-->` +
    `<template data-herb-manifests>${JSON.stringify({
      [`${PARENT}:${PARENT_VERSION}`]: manifest(PARENT, PARENT_VERSION, PARENT_STATES, bindings),
      [`${CHILD}:${CHILD_VERSION}`]: manifest(CHILD, CHILD_VERSION, CHILD_STATES),
    })}</template>`
  )
}

let slots: Slots
let state: State
let actions: Actions

function mount(html: string): void {
  document.body.innerHTML = html

  slots = new Slots()
  slots.scan(document.body)

  state = new State(slots, {})
  state.adopt()

  actions = new Actions(state)
  actions.start(document.body)
}

function text(id: string): string {
  return document.getElementById(id)!.textContent ?? ""
}

function parentScope() {
  return { region: slots.region(PARENT)!, item: null }
}

function childScope() {
  return { region: slots.region(CHILD)!, item: null }
}

afterEach(() => actions?.stop())

describe("a partial bound to its caller's state", () => {
  beforeEach(() => mount(page(BINDINGS)))

  test("records the region it sits in and the slot that holds it", () => {
    const child = slots.region(CHILD)!

    expect(child.parent).toBe(slots.region(PARENT))
    expect(child.slot?.index).toBe(1)
    expect(child.item).toBeNull()
    expect(slots.bindingsFor(child)).toEqual(BINDINGS[1])
    expect(slots.region(PARENT)!.parent).toBeNull()
  })

  test("reads the caller's value through the alias", () => {
    expect(state.getState("open", { scope: childScope() })).toBe(false)

    state.setState({ modal_open: true }, { scope: parentScope() })

    expect(state.getState("open", { scope: childScope() })).toBe(true)
    expect(state.getState("modal_open", { scope: parentScope() })).toBe(true)
  })

  test("rewrites the partial's slots when the caller writes", () => {
    state.setState({ modal_open: true }, { scope: parentScope() })

    expect(text("parent-text")).toBe("true")
    expect(text("child-text")).toBe("true")
  })

  test("writes the caller's state when the partial writes", () => {
    state.setState({ modal_open: true }, { scope: parentScope() })

    document.getElementById("child-close")!.click()

    expect(state.getState("modal_open", { scope: parentScope() })).toBe(false)
    expect(text("parent-text")).toBe("false")
    expect(text("child-text")).toBe("false")
  })

  test("leaves the partial's own states alone", () => {
    document.getElementById("child-label-set")!.click()

    expect(state.getState("label", { scope: childScope() })).toBe("hi")
    expect(text("child-label")).toBe("hi")
    expect(state.declares(parentScope(), "label")).toBe(false)
  })

  test("announces both names once per write", () => {
    const seen: string[] = []
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<StateChangeDetail>).detail

      seen.push(`${detail.file}:${detail.name}=${String(detail.value)}`)
    }

    document.addEventListener(STATE_EVENT, handler)

    try {
      document.getElementById("parent-toggle")!.click()

      expect(seen).toEqual([`${PARENT}:modal_open=true`, `${CHILD}:open=true`])

      seen.length = 0
      document.getElementById("child-close")!.click()

      expect(seen).toEqual([`${PARENT}:modal_open=false`, `${CHILD}:open=false`])
    } finally {
      document.removeEventListener(STATE_EVENT, handler)
    }
  })

  test("a listener on the partial's scope fires when the caller writes", () => {
    const listener = vi.fn()
    const stop = state.on("open", listener, { scope: childScope() })

    state.setState({ modal_open: true }, { scope: parentScope() })

    stop()

    expect(listener).toHaveBeenCalledTimes(1)
  })
})

describe("a nested partial without bindings", () => {
  beforeEach(() => mount(page({})))

  test("keeps its own state apart from the caller's", () => {
    expect(slots.region(CHILD)!.parent).toBe(slots.region(PARENT))
    expect(slots.bindingsFor(slots.region(CHILD)!)).toBeNull()

    state.setState({ modal_open: true }, { scope: parentScope() })

    expect(text("parent-text")).toBe("true")
    expect(text("child-text")).toBe("")
    expect(state.getState("open", { scope: childScope() })).toBe(false)

    document.getElementById("child-close")!.click()

    expect(state.getState("modal_open", { scope: parentScope() })).toBe(true)
  })
})

describe("steering a bound partial", () => {
  let runtime: Runtime | null = null

  afterEach(() => {
    runtime?.stop()
    runtime = null
    document.body.innerHTML = ""
  })

  test("sends the caller's value under the partial's own file", async () => {
    const child = manifest(CHILD, CHILD_VERSION, { ...CHILD_STATES, server: { reads: { open: [{ index: 0, node_path: [0] }] } } })

    document.body.innerHTML =
      `<!--herb-region:${PARENT}:${PARENT_VERSION}:0-->` +
      `<p><!--herb-slot:0--><!--/herb-slot:0--></p>` +
      `<div><!--herb-slot:1-->` +
      `<!--herb-region:${CHILD}:${CHILD_VERSION}:0--><span><!--herb-slot:0--><!--/herb-slot:0--></span><!--/herb-region:${CHILD}-->` +
      `<!--/herb-slot:1--></div>` +
      `<!--/herb-region:${PARENT}-->` +
      `<template data-herb-manifests>${JSON.stringify({
        [`${PARENT}:${PARENT_VERSION}`]: manifest(PARENT, PARENT_VERSION, PARENT_STATES, BINDINGS),
        [`${CHILD}:${CHILD_VERSION}`]: child,
      })}</template>`

    const transport = vi.fn(() => new Promise<never>(() => {}))

    runtime = Runtime.start({ state: { refetchTransport: transport as never, refetchDebounce: 0 } })

    runtime.state.setState({ modal_open: true })

    await vi.waitFor(() => {
      if (transport.mock.calls.length === 0) {
        throw new Error("no refetch yet")
      }
    })

    const steering = (transport.mock.calls[0] as unknown[])[0] as Record<string, Record<string, unknown>>

    expect(steering[CHILD]).toEqual({ open: true })
  })
})
