import { describe, test, expect, afterEach, vi } from "vitest"

import { Runtime } from "../src/runtime"

import type { Payload } from "../src/types"

type Steering = Record<string, Record<string, unknown>>

const MESSAGES = "app/views/messages/index.html.erb"

const MESSAGES_STATES = {
  version: "aaaaaaaa",
  declarations: [
    { name: "composing", kind: "boolean", default: "false", value: false, scope: "region" },
    { name: "order", kind: "string", default: '"oldest"', value: "oldest", scope: "region" },
  ],
  reads: {},
  conditionals: { 0: { arms: [{ branch: 0, condition: ["order", { value: "newest" }, "=="] }], else: 1 } },
  presence: {},
  computed: {},
}

const MESSAGES_PAGE =
  `<!--herb-region:${MESSAGES}:aaaaaaaa:0-->` +
  `<p><!--herb-slot:0:conditional--><!--herb-branch:0:1-->Oldest messages first<!--/herb-slot:0--></p>` +
  `<ul><!--herb-slot:1-->first, second<!--/herb-slot:1--></ul>` +
  `<!--/herb-region:${MESSAGES}-->` +
  `<template data-herb-dependencies>${JSON.stringify({ state: {}, states: { [MESSAGES]: MESSAGES_STATES } })}</template>`

function messagesPayload(order: unknown): Payload {
  const newest = order === "newest"
  const branch = newest ? 0 : 1
  const text = newest ? "Newest messages first" : "Oldest messages first"

  return {
    template: MESSAGES,
    version: "aaaaaaaa",
    occurrence: 0,
    slots: {
      0: { branch, statics: `<!--herb-branch:0:${branch}-->${text}`, slots: {} },
      1: newest ? "second, first" : "first, second",
    },
  } as unknown as Payload
}

const CARD = "app/views/items/_card.html.erb"

const CARD_STATES = {
  version: "bbbbbbbb",
  declarations: [{ name: "open", kind: "boolean", default: "false", value: false, scope: "region" }],
  reads: {},
  conditionals: { 0: { arms: [{ branch: 0, condition: ["open", null] }], else: null } },
  presence: {},
  computed: {},
}

function card(occurrence: number): string {
  return (
    `<!--herb-region:${CARD}:bbbbbbbb:${occurrence}-->` +
    `<article id="card-${occurrence}"><button>Open</button><!--herb-slot:0:conditional--><!--/herb-slot:0--></article>` +
    `<!--/herb-region:${CARD}-->`
  )
}

const CARDS_PAGE = card(0) + card(1) + card(2) + `<template data-herb-dependencies>${JSON.stringify({ state: {}, states: { [CARD]: CARD_STATES } })}</template>`

function cardPayload(occurrence: number, open: boolean): Payload {
  return {
    template: CARD,
    version: "bbbbbbbb",
    occurrence,
    slots: { 0: open ? { branch: 0, statics: "<!--herb-branch:0:0--><form>edit</form>", slots: {} } : { branch: null } },
  } as unknown as Payload
}

let runtime: Runtime | null = null

afterEach(() => {
  runtime?.stop()
  runtime = null
  document.body.innerHTML = ""
})

async function settled(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 30))
}

describe("server mode steering", () => {
  test("every change to a state a server-rendered conditional reads asks the server", async () => {
    document.body.innerHTML = MESSAGES_PAGE

    const calls: Steering[] = []
    const transport = vi.fn(async (state: Steering) => {
      calls.push(state)

      return messagesPayload(state[MESSAGES]?.order)
    })

    runtime = Runtime.start({ state: { refetchTransport: transport, refetchDebounce: 0 } })

    runtime.state.setState({ order: "newest" })
    await settled()

    expect(document.querySelector("p")?.textContent).toBe("Newest messages first")
    expect(document.querySelector("ul")?.textContent).toBe("second, first")

    runtime.state.setState({ order: "oldest" })
    await settled()

    expect(document.querySelector("p")?.textContent).toBe("Oldest messages first")
    expect(document.querySelector("ul")?.textContent).toBe("first, second")

    runtime.state.setState({ order: "newest" })
    await settled()

    expect(document.querySelector("ul")?.textContent).toBe("second, first")
    expect(calls).toEqual([
      { [MESSAGES]: { order: "newest" } },
      { [MESSAGES]: { order: "oldest" } },
      { [MESSAGES]: { order: "newest" } },
    ])
  })

  test("a later copy of a partial sends its own state, layered over the first copy's", async () => {
    document.body.innerHTML = CARDS_PAGE

    const calls: Steering[] = []
    const transport = vi.fn(async (state: Steering) => {
      calls.push(state)

      return cardPayload(1, true)
    })

    runtime = Runtime.start({ state: { refetchTransport: transport, refetchDebounce: 0 } })

    runtime.state.setState({ open: true }, { scope: document.querySelector("#card-1 button")! })
    await settled()

    expect(calls).toEqual([{ [CARD]: { open: false, "@occurrences": { 1: { open: true } } } }])
    expect(document.querySelector("#card-0")?.textContent).toBe("Open")
    expect(document.querySelector("#card-1")?.textContent).toBe("Openedit")
    expect(document.querySelector("#card-2")?.textContent).toBe("Open")
  })

  test("each copy that differs from the first one sends its own values", async () => {
    document.body.innerHTML = CARDS_PAGE

    const calls: Steering[] = []
    const transport = vi.fn(async (state: Steering) => {
      calls.push(state)

      return cardPayload(0, true)
    })

    runtime = Runtime.start({ state: { refetchTransport: transport, refetchDebounce: 0 } })

    runtime.state.setState({ open: true }, { scope: document.querySelector("#card-0 button")! })
    await settled()

    expect(calls).toEqual([{ [CARD]: { open: true, "@occurrences": { 1: { open: false }, 2: { open: false } } } }])
  })
})
