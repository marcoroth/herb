import { describe, test, expect, beforeEach, afterEach } from "vitest"
import { Slots } from "../src/slots/slots"
import { State } from "../src/state/state"

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

let slots: Slots
let state: State

beforeEach(() => {
  document.body.innerHTML = PAGE

  slots = new Slots()
  slots.scan(document.body)

  state = new State(slots, { persist: "none" })
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

describe("property sync after user interaction", () => {
  const SYNC_FILE = "app/views/page/sync.html.erb"

  const SYNC_PAGE =
    `<!--herb-region:${SYNC_FILE}:beefcafe:0-->` +
    `<input id="agree" type="checkbox" data-herb-slot="0:boolean_attribute:checked">` +
    `<select id="pick"><option value="name">name</option><option value="date" data-herb-slot="1:boolean_attribute:selected">date</option></select>` +
    `<button id="submit" data-herb-slot="2:boolean_attribute:disabled">Send</button>` +
    `<input id="draft" value="" data-herb-slot="3:attribute:value">` +
    `<!--/herb-region:${SYNC_FILE}-->` +
    `<template data-herb-dependencies>${JSON.stringify({
      state: {},
      states: {
        [SYNC_FILE]: {
          version: "beefcafe",
          declarations: [
            { name: "agreed", kind: "boolean", default: "false", scope: "region" },
            { name: "dated", kind: "boolean", default: "false", scope: "region" },
            { name: "pending", kind: "boolean", default: "false", scope: "region" },
            { name: "draft", kind: "string", default: '""', scope: "region" },
          ],
          reads: { agreed: [0], dated: [1], pending: [2], draft: [3] },
          bound: { agreed: [0], draft: [3] },
          conditionals: {},
          presence: { 0: ["agreed", null], 1: ["dated", null], 2: ["pending", null] },
        },
      },
    })}</template>`

  let syncSlots: Slots
  let syncState: State

  beforeEach(() => {
    document.body.innerHTML = SYNC_PAGE

    syncSlots = new Slots()
    syncSlots.scan(document.body)

    syncState = new State(syncSlots, { persist: "none" })
    syncState.adopt()
    syncState.observe()
  })

  afterEach(() => syncState.disconnect())

  test("a checkbox follows the state after the user has clicked it", () => {
    const checkbox = document.querySelector<HTMLInputElement>("#agree")!

    checkbox.click()

    expect(syncState.getState("agreed")).toBe(true)
    expect(checkbox.checked).toBe(true)

    syncState.setState({ agreed: false })

    expect(checkbox.hasAttribute("checked")).toBe(false)
    expect(checkbox.checked).toBe(false)

    syncState.setState({ agreed: true })

    expect(checkbox.checked).toBe(true)
  })

  test("an option follows the state after the user has picked another", () => {
    const select = document.querySelector<HTMLSelectElement>("#pick")!

    select.value = "name"
    select.dispatchEvent(new Event("change", { bubbles: true }))

    syncState.setState({ dated: true })

    expect(select.querySelector<HTMLOptionElement>("option[value=date]")!.selected).toBe(true)
    expect(select.value).toBe("date")
  })

  test("a disabled button follows the state", () => {
    const button = document.querySelector<HTMLButtonElement>("#submit")!

    expect(button.disabled).toBe(false)

    syncState.setState({ pending: true })

    expect(button.disabled).toBe(true)

    syncState.setState({ pending: false })

    expect(button.disabled).toBe(false)
  })

  test("a bound input's value property follows a programmatic set", () => {
    const input = document.querySelector<HTMLInputElement>("#draft")!

    input.value = "typed by hand"
    input.dispatchEvent(new Event("input", { bubbles: true }))

    syncState.setState({ draft: "from code" })

    expect(input.getAttribute("value")).toBe("from code")
    expect(input.value).toBe("from code")
  })
})

const AREA_FILE = "app/views/page/note.html.erb"

const AREA_PAGE =
  `<!--herb-region:${AREA_FILE}:bbbbbbbb:0-->` +
  `<textarea data-herb-slot="0:raw_text">hi</textarea>` +
  `<!--/herb-region:${AREA_FILE}-->` +
  `<template data-herb-dependencies>${JSON.stringify({
    state: {},
    states: {
      [AREA_FILE]: {
        version: "bbbbbbbb",
        declarations: [{ name: "note", kind: "string", default: '"hi"', scope: "region" }],
        reads: { note: [0] },
        bound: { note: [0] },
        conditionals: {},
      },
    },
  })}</template>`

describe("a state rendered as a textarea's content", () => {
  test("a write reaches the textarea", () => {
    document.body.innerHTML = AREA_PAGE

    const areaSlots = new Slots()

    areaSlots.scan(document.body)

    const areaState = new State(areaSlots, {
      persist: "none",
      transport: () => {
        throw new Error("a declared state must never reach the transport")
      },
    })

    areaState.adopt()

    expect(areaState.setState({ note: "rewritten" })).toBe(true)
    expect(document.querySelector("textarea")?.value).toBe("rewritten")
  })
})
