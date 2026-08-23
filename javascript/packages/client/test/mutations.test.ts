import { describe, test, expect, beforeEach } from "vitest"
import { SlotIndex } from "../src/slot-index"
import { SlotMutations } from "../src/mutations"
import { SlotState } from "../src/state"

import type { Payload } from "../src/types"
import type { MutationRequest } from "../src/mutations"

const FILE = "app/views/conversations/show.html.erb"

const PAGE =
  `<!--herb-region:${FILE}:aaaaaaaa:0-->` +
  `<ul data-herb-name="0:messages"><!--herb-slot:0:collection-->` +
  `<!--herb-item:0:message_1--><li id="message_1" data-herb-slot="1:attribute:id">` +
  `<span data-herb-name="2:body" data-herb-slot="2:child">hello</span>` +
  `<em><!--herb-slot:3:conditional--><!--herb-branch:3:2-->Sent<!--/herb-slot:3--></em></li><!--/herb-item:0-->` +
  `<!--/herb-slot:0--></ul>` +
  `<template data-herb-region="${FILE}:aaaaaaaa">` +
  `<!--herb-branch:3:0-->Sending…<!--herb-branch:3:1-->Not sent<!--herb-branch:3:2-->Sent` +
  `</template>` +
  `<!--/herb-region:${FILE}-->` +
  `<template data-herb-dependencies>${JSON.stringify({
    state: {},
    states: {
      [FILE]: {
        version: "aaaaaaaa",
        declarations: [
          { name: "pending", kind: "boolean", default: "false", scope: 0 },
          { name: "failed", kind: "boolean", default: "false", scope: 0 },
        ],
        reads: {},
        conditionals: { 3: { arms: [["pending", null, 0], ["failed", null, 1]], else: 2 } },
      },
    },
  })}</template>`

function confirmPayload(key: string, body: string): Payload {
  return {
    template: FILE,
    version: "aaaaaaaa",
    occurrence: 0,
    slots: { 0: { items: { [key]: { 1: key, 2: body } } }, 9: "unrelated" },
  }
}

let slots: SlotIndex
let state: SlotState

function build(transport: (request: MutationRequest, signal: AbortSignal) => Promise<Payload | null>): SlotMutations {
  return new SlotMutations(slots, state, { transport })
}

beforeEach(() => {
  document.body.innerHTML = PAGE

  slots = new SlotIndex()
  slots.scan(document.body)

  state = new SlotState(slots, { persist: "none" })
  state.adopt()
})

describe("SlotMutations", () => {
  function insertForm(into: string): HTMLFormElement {
    const form = document.createElement("form")

    form.action = "/messages"
    form.method = "post"
    form.setAttribute("data-herb-into", into)
    form.innerHTML = `<input name="message[body]" value="from the form"><input name="authenticity_token" value="tok">`

    document.querySelector("ul")!.after(form)

    return form
  }

  test("a submitted form derives the whole send from itself", async () => {
    let seen: MutationRequest | null = null
    const mutations = build((request) => {
      seen = request

      return Promise.resolve(confirmPayload("message_9", "from the server"))
    })

    mutations.observe(document)

    const form = insertForm("messages")

    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))

    const rows = document.querySelectorAll("li")

    expect(rows).toHaveLength(2)
    expect(rows[1].textContent).toContain("from the form")

    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(seen!.url).toBe("/messages")
    expect(seen!.method).toBe("POST")
    expect(document.querySelector("#message_9")?.textContent).toContain("from the server")

    mutations.unobserve()
  })

  test("a submitted form returns its bound states to what the server rendered", async () => {
    document.body.innerHTML = PAGE.replace(
      "</ul>",
      '</ul><input value="" data-herb-slot="5:attribute:value">',
    ).replace('"reads":{}', '"reads":{"draft":[5]}').replace(
      '"conditionals"',
      '"bound":{"draft":[5]},"conditionals"',
    ).replace('"declarations":[', '"declarations":[{"name":"draft","kind":"string","default":"\\"\\"","scope":"region"},')
    slots = new SlotIndex()
    slots.scan(document.body)
    state = new SlotState(slots, { persist: "none" })
    state.adopt()
    state.observe()

    const input = document.querySelector<HTMLInputElement>("input[data-herb-slot]")!

    input.value = "typed"
    input.dispatchEvent(new Event("input", { bubbles: true }))

    expect(state.getState("draft")).toBe("typed")

    const mutations = build(() => Promise.resolve(confirmPayload("message_9", "sent")))

    mutations.observe(document)

    const form = insertForm("messages")

    form.append(input)
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))

    expect(state.getState("draft")).toBe("")
    expect(input.value).toBe("")

    await new Promise((resolve) => setTimeout(resolve, 0))

    mutations.unobserve()
    state.disconnect()
  })

  test("a form naming no collection reports and sends nothing", () => {
    const entries: { code: string }[] = []

    ;(window as unknown as { HerbDevTools?: unknown }).HerbDevTools = {
      report: (input: unknown) => entries.push(input as { code: string }),
    }

    const mutations = build(() => Promise.reject(new Error("must not be called")))

    mutations.observe(document)

    const form = insertForm("missing")

    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))

    expect(document.querySelectorAll("li")).toHaveLength(1)
    expect(entries.map((entry) => entry.code)).toEqual(["herb-unknown-collection"])

    mutations.unobserve()
    delete (window as unknown as { HerbDevTools?: unknown }).HerbDevTools
  })

  test("a form naming a slot that is not a collection reports it", () => {
    document.body.innerHTML = PAGE.replace("</ul>", '</ul><p data-herb-name="4:note"><!--herb-slot:4-->x<!--/herb-slot:4--></p>')
    slots = new SlotIndex()
    slots.scan(document.body)
    state = new SlotState(slots, { persist: "none" })
    state.adopt()

    const entries: { code: string }[] = []

    ;(window as unknown as { HerbDevTools?: unknown }).HerbDevTools = {
      report: (input: unknown) => entries.push(input as { code: string }),
    }

    const mutations = build(() => Promise.reject(new Error("must not be called")))

    mutations.observe(document)

    const form = insertForm("note")

    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))

    expect(entries).toHaveLength(1)
    expect((entries[0] as { message?: string }).message).toContain("a send needs a collection")

    mutations.unobserve()
    delete (window as unknown as { HerbDevTools?: unknown }).HerbDevTools
  })

  test("the row appears pending before the request resolves, and the node survives the confirm", async () => {
    let release!: (payload: Payload) => void
    const mutations = build(() => new Promise((resolve) => (release = resolve)))

    const result = mutations.submit({
      url: "/messages",
      body: { body: "typed" },
      into: { file: FILE, name: "messages" },
      values: { body: "typed" },
    })

    await Promise.resolve()

    const pendingRow = document.querySelectorAll("li")[1]

    expect(pendingRow.textContent).toContain("typed")
    expect(pendingRow.textContent).toContain("Sending…")

    release(confirmPayload("message_42", "stored"))

    const outcome = await result

    expect(outcome.status).toBe("confirmed")
    expect(outcome.key).toBe("message_42")
    expect(document.querySelector("#message_42")).toBe(pendingRow)
    expect(pendingRow.textContent).toContain("stored")
    expect(pendingRow.textContent).toContain("Sent")
    expect(document.querySelectorAll("li")).toHaveLength(2)
  })

  test("two rapid sends both land, in order, with neither aborted", async () => {
    const seen: string[] = []
    const mutations = build((request) => {
      const body = (request.body as Record<string, string>).body

      seen.push(body)

      return Promise.resolve(confirmPayload(`message_${body}`, body))
    })

    const first = mutations.submit({ url: "/messages", body: { body: "one" }, into: { file: FILE, name: "messages" }, values: { body: "one" } })
    const second = mutations.submit({ url: "/messages", body: { body: "two" }, into: { file: FILE, name: "messages" }, values: { body: "two" } })

    const outcomes = await Promise.all([first, second])

    expect(outcomes.map((outcome) => outcome.status)).toEqual(["confirmed", "confirmed"])
    expect(seen).toEqual(["one", "two"])
    expect(document.querySelectorAll("li")).toHaveLength(3)
  })

  test("a failed send keeps the row, marks it, and retry recovers it", async () => {
    let attempts = 0
    const mutations = build(() => {
      attempts += 1

      if (attempts === 1) return Promise.reject(new Error("boom"))

      return Promise.resolve(confirmPayload("message_9", "recovered"))
    })

    const failed = await mutations.submit({
      url: "/messages",
      body: { body: "flaky" },
      into: { file: FILE, name: "messages" },
      values: { body: "flaky" },
    })

    expect(failed.status).toBe("failed")

    const rows = document.querySelectorAll("li")

    expect(rows).toHaveLength(2)
    expect(rows[1].textContent).toContain("Not sent")

    const retried = await mutations.retry(failed.key)!

    expect(retried.status).toBe("confirmed")
    expect(document.querySelector("#message_9")?.textContent).toContain("Sent")
  })

  test("retry and discard accept the element inside the row", async () => {
    let attempts = 0
    const mutations = build(() => {
      attempts += 1

      if (attempts === 1) return Promise.reject(new Error("boom"))

      return Promise.resolve(confirmPayload("message_9", "recovered"))
    })

    const failed = await mutations.submit({
      url: "/messages",
      body: { body: "flaky" },
      into: { file: FILE, name: "messages" },
      values: { body: "flaky" },
    })

    const row = document.querySelectorAll("li")[1]!
    const retried = await mutations.retry(row)!

    expect(failed.status).toBe("failed")
    expect(retried.status).toBe("confirmed")

    const second = await mutations.submit({
      url: "/messages",
      body: {},
      into: { file: FILE, name: "messages" },
      values: { body: "oops" },
    })

    expect(second.status).toBe("confirmed")
    expect(mutations.discard(document.querySelector("section")!)).toBe(false)
  })

  test("discard reverts the optimistic row", async () => {
    const mutations = build(() => Promise.reject(new Error("down")))
    const failed = await mutations.submit({
      url: "/messages",
      body: {},
      into: { file: FILE, name: "messages" },
      values: { body: "gone" },
    })

    expect(mutations.discard(failed.key)).toBe(true)
    expect(document.querySelectorAll("li")).toHaveLength(1)
  })

  test("the confirm is narrowed to the collection", async () => {
    const mutations = build(() => Promise.resolve(confirmPayload("message_5", "narrow")))

    const outcome = await mutations.submit({
      url: "/messages",
      body: {},
      into: { file: FILE, name: "messages" },
      values: { body: "narrow" },
    })

    expect(outcome.report?.deferred).toEqual([])
  })

  test("a stale version surfaces as its own status", async () => {
    const stale: Payload = { ...confirmPayload("message_6", "old"), version: "bbbbbbbb" }
    const mutations = build(() => Promise.resolve(stale))

    const outcome = await mutations.submit({
      url: "/messages",
      body: {},
      into: { file: FILE, name: "messages" },
      values: { body: "old" },
    })

    expect(outcome.status).toBe("stale")
    expect(document.querySelectorAll("li")[1]?.textContent).not.toContain("Sending…")
  })

  test("a confirm carrying several rows reports the ambiguity", async () => {
    const entries: { code: string }[] = []

    ;(window as unknown as { HerbDevTools?: unknown }).HerbDevTools = {
      report: (input: unknown) => {
        if (Array.isArray(input)) entries.push(...(input as { code: string }[]))
        else entries.push(input as { code: string })
      },
    }

    const wide: Payload = {
      template: FILE,
      version: "aaaaaaaa",
      occurrence: 0,
      slots: { 0: { items: { message_1: { 2: "kept" }, message_2: { 2: "also kept" } } } },
    }

    const mutations = build(() => Promise.resolve(wide))

    const outcome = await mutations.submit({
      url: "/messages",
      body: {},
      into: { file: FILE, name: "messages" },
      values: { body: "typed" },
    })

    expect(outcome.key).not.toBe("message_1")
    expect(entries.map((entry) => entry.code)).toContain("herb-ambiguous-confirm")

    delete (window as unknown as { HerbDevTools?: unknown }).HerbDevTools
  })

  test("an optimistic value renders as text, never as markup", async () => {
    const mutations = build(() => Promise.resolve(null))

    await mutations.submit({
      url: "/messages",
      body: {},
      into: { file: FILE, name: "messages" },
      values: { body: '<img src="x" onerror="window.__pwned = true">' },
    })

    const fresh = document.querySelectorAll("li")[1]

    expect(fresh.querySelector("img")).toBeNull()
    expect(fresh.textContent).toContain('<img src="x"')
  })

  test("a submit with no reachable collection is detached but still sends", async () => {
    const mutations = build(() => Promise.resolve(null))

    const outcome = await mutations.submit({ url: "/messages", body: {}, into: { file: "missing.html.erb", index: 0 } })

    expect(outcome.status).toBe("detached")
    expect(document.querySelectorAll("li")).toHaveLength(1)
  })

  test("the request carries the verb, the accept header, and the csrf token", async () => {
    document.head.innerHTML = `<meta name="csrf-token" content="tok123">`

    let captured: MutationRequest | null = null
    const mutations = build((request) => {
      captured = request

      return Promise.resolve(null)
    })

    await mutations.submit({ url: "/messages", body: {}, into: { file: FILE, name: "messages" } })

    expect(captured!.method).toBe("POST")
    expect(captured!.headers.Accept).toBe("application/vnd.herb.slots+json")
    expect(captured!.headers["X-CSRF-Token"]).toBe("tok123")
  })
})

describe("a template that declares no mutation states", () => {
  const PLAIN_FILE = "app/views/conversations/plain.html.erb"

  const PLAIN_PAGE =
    `<!--herb-region:${PLAIN_FILE}:bbbbbbbb:0-->` +
    `<ul data-herb-name="0:messages"><!--herb-slot:0:collection-->` +
    `<!--herb-item:0:message_1--><li id="message_1" data-herb-slot="1:attribute:id">` +
    `<span data-herb-name="2:body" data-herb-slot="2:child">hello</span></li><!--/herb-item:0-->` +
    `<!--/herb-slot:0--></ul>` +
    `<template data-herb-region="${PLAIN_FILE}:bbbbbbbb">` +
    `<!--herb-branch:0:item--><!--herb-item:0:--><li id="" data-herb-slot="1:attribute:id">` +
    `<span data-herb-name="2:body" data-herb-slot="2:child"></span></li><!--/herb-item:0-->` +
    `</template>` +
    `<!--/herb-region:${PLAIN_FILE}-->` +
    `<template data-herb-dependencies>${JSON.stringify({
      state: {},
      states: {
        [PLAIN_FILE]: {
          version: "bbbbbbbb",
          declarations: [{ name: "filter", kind: "string", default: '"all"', value: "all", scope: "region" }],
          reads: {},
          conditionals: {},
        },
      },
    })}</template>`

  test("sends the row without asking for a state the template does not have", async () => {
    const entries: { code?: string }[] = []

    ;(window as unknown as { HerbDevTools?: unknown }).HerbDevTools = {
      report(input: unknown) {
        entries.push(...(Array.isArray(input) ? input : [input]))
      },
      clear() {},
    }

    document.body.innerHTML = PLAIN_PAGE

    const plainSlots = new SlotIndex()
    plainSlots.scan(document.body)

    const plainState = new SlotState(plainSlots, { persist: "none", transport: async () => null })
    plainState.adopt()

    const plainMutations = new SlotMutations(plainSlots, plainState, {
      transport: async () => ({ template: PLAIN_FILE, version: "bbbbbbbb", occurrence: 0, slots: {} }) as Payload,
    })

    const result = await plainMutations.submit({
      url: "/messages",
      body: { body: "hi" },
      into: { file: PLAIN_FILE, name: "messages" },
      values: { body: "hi" },
    })

    expect(result.status).toBe("confirmed")
    expect(document.body.textContent).toContain("hi")
    expect(entries.map((entry) => entry.code)).not.toContain("herb-unknown-state")

    delete (window as unknown as { HerbDevTools?: unknown }).HerbDevTools
  })
})
