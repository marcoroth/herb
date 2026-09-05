import { describe, test, expect, beforeEach, afterEach } from "vitest"
import { Actions } from "../src/actions/actions"
import { Slots } from "../src/slots/slots"
import { State } from "../src/state/state"
import { STATE_EVENT } from "../src/shared/events"
import { resetReport } from "../src/shared/report"

const FILE = "app/views/page/panel.html.erb"

const PAGE =
  `<!--herb-region:${FILE}:aaaaaaaa:0-->` +
  `<section>` +
  `<button id="toggle" data-herb-toggle="open">Details</button>` +
  `<button id="both" data-herb-set="pending=false failed=true">Fail</button>` +
  `<button id="blank" data-herb-set="sort=''">Clear</button>` +
  `<button id="bump" data-herb-increment="attempts" data-herb-by="2">More</button>` +
  `<button id="combo" data-herb-increment="attempts" data-herb-set="open=true">Both</button>` +
  `<button id="same" data-herb-increment="attempts" data-herb-set="attempts=10">Same</button>` +
  `<button id="arrowed" data-herb-set="click->open=true" data-herb-increment="attempts">Arrowed</button>` +
  `<button id="trio" data-herb-toggle="open" data-herb-increment="attempts" data-herb-reset="sort">Trio</button>` +
  `<button id="tab-a" data-herb-set="sort=name">A</button>` +
  `<button id="quoted" data-herb-set="sort='hello, world'">Q</button>` +
  `<form id="form" data-herb-set="pending=true"><input id="draft-input" data-herb-reset="blur->sort"></form>` +
  `<input id="typer" data-herb-set="sort=$value">` +
  `<input id="bound" value="name" data-herb-slot="5:attribute:value">` +
  `<button id="setter" data-herb-set="sort=date">Date</button>` +
  `<select id="chooser" data-herb-set="sort=$value"><option value="date">date</option></select>` +
  `<div id="menu" data-herb-set="mouseenter->open=true mouseleave->open=false">hover</div>` +
  `<div><!--herb-slot:0:conditional--><!--herb-branch:0:1-->closed<!--/herb-slot:0--></div>` +
  `<p><!--herb-slot:1-->0<!--/herb-slot:1--></p>` +
  `<ul><!--herb-slot:2:collection-->` +
  `<!--herb-item:2:a--><li id="a" data-herb-slot="3:attribute:id"><button class="star" data-herb-toggle="starred">s</button>` +
  `<em><!--herb-slot:4:conditional--><!--herb-branch:4:1-->plain<!--/herb-slot:4--></em></li><!--/herb-item:2-->` +
  `<!--herb-item:2:b--><li id="b" data-herb-slot="3:attribute:id"><button class="star" data-herb-toggle="starred">s</button>` +
  `<em><!--herb-slot:4:conditional--><!--herb-branch:4:1-->plain<!--/herb-slot:4--></em></li><!--/herb-item:2-->` +
  `<!--/herb-slot:2--></ul>` +
  `</section>` +
  `<template data-herb-region="${FILE}:aaaaaaaa">` +
  `<!--herb-branch:0:0-->opened<!--herb-branch:0:1-->closed` +
  `<!--herb-branch:4:0-->starred<!--herb-branch:4:1-->plain` +
  `</template>` +
  `<!--/herb-region:${FILE}-->` +
  `<template data-herb-dependencies>${JSON.stringify({
    state: {},
    states: {
      [FILE]: {
        version: "aaaaaaaa",
        declarations: [
          { name: "open", kind: "boolean", default: "false", scope: "region" },
          { name: "pending", kind: "boolean", default: "false", scope: "region" },
          { name: "failed", kind: "boolean", default: "false", scope: "region" },
          { name: "attempts", kind: "integer", default: "0", scope: "region" },
          { name: "sort", kind: "string", default: '"name"', scope: "region" },
          { name: "starred", kind: "boolean", default: "false", scope: 2 },
        ],
        reads: { attempts: [1], sort: [5] },
        bound: { sort: [5] },
        conditionals: {
          0: { arms: [["open", null, 0]], else: 1 },
          4: { arms: [["starred", null, 0]], else: 1 },
        },
      },
    },
  })}</template>`

let slots: Slots
let state: State
let actions: Actions

function click(selector: string): void {
  document.querySelector<HTMLElement>(selector)!.dispatchEvent(new MouseEvent("click", { bubbles: true }))
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

describe("declarative actions", () => {
  test("a click toggles a boolean and flips its branch", () => {
    click("#toggle")

    expect(state.getState("open")).toBe(true)
    expect(document.querySelector("div:not([id])")?.textContent).toContain("opened")

    click("#toggle")

    expect(state.getState("open")).toBe(false)
  })

  test("two clauses on one attribute both write", () => {
    const order: string[] = []
    const handler = (event: Event): void => {
      order.push((event as CustomEvent<{ name: string }>).detail.name)
    }

    document.addEventListener(STATE_EVENT, handler)
    click("#both")
    document.removeEventListener(STATE_EVENT, handler)

    expect(state.getState("pending")).toBe(false)
    expect(state.getState("failed")).toBe(true)
    expect(order).toEqual(["pending", "failed"])
  })

  test("a comma list is no longer a clause, and writes nothing", () => {
    const entries: { code?: string }[] = []

    ;(window as unknown as { HerbDevTools?: unknown }).HerbDevTools = {
      report: (input: unknown) => entries.push(...[input].flat() as { code?: string }[]),
    }

    const legacy = document.createElement("button")

    legacy.id = "legacy"
    legacy.setAttribute("data-herb-set", "pending=true,failed=true")
    document.querySelector("section")!.append(legacy)

    actions.stop()
    actions = new Actions(state)
    actions.start(document.body)

    click("#legacy")

    expect(state.getState("pending")).not.toBe(true)
    expect(state.getState("failed")).not.toBe(true)
    expect(entries.some((entry) => entry.code === "herb-invalid-action")).toBe(true)

    delete (window as unknown as { HerbDevTools?: unknown }).HerbDevTools
  })

  test("an empty quoted value sets the state to the empty string", () => {
    click("#tab-a")

    expect(state.getState("sort")).toBe("name")

    click("#blank")

    expect(state.getState("sort")).toBe("")
  })

  test("a set writes through to the bound input", () => {
    click("#setter")

    expect(state.getState("sort")).toBe("date")

    const bound = document.querySelector<HTMLInputElement>("#bound")!

    expect(bound.getAttribute("value")).toBe("date")
    expect(bound.value).toBe("date")
  })

  test("two action attributes on one element both run", () => {
    click("#combo")

    expect(state.getState("attempts")).toBe(1)
    expect(state.getState("open")).toBe(true)
  })

  test("increment and set on the same state apply set first, then the step", () => {
    click("#same")

    expect(state.getState("attempts")).toBe(11)
  })

  test("an arrowed set and a bare increment both fire on one click", () => {
    click("#arrowed")

    expect(state.getState("open")).toBe(true)
    expect(state.getState("attempts")).toBe(1)
  })

  test("three action attributes on one element all fire", () => {
    state.setState({ sort: "date" })

    click("#trio")

    expect(state.getState("open")).toBe(true)
    expect(state.getState("attempts")).toBe(1)
    expect(state.getState("sort")).toBe("name")
  })

  test("increment honours data-herb-by", () => {
    click("#bump")
    click("#bump")

    expect(state.getState("attempts")).toBe(4)
    expect(document.querySelector("p")?.textContent).toContain("4")
  })

  test("a step that does not parse falls back to one", () => {
    const bump = document.querySelector("#bump")!

    bump.setAttribute("data-herb-by", "two")
    click("#bump")

    expect(state.getState("attempts")).toBe(1)
  })

  test("a stopped runtime detaches its hover listeners", () => {
    const menu = document.querySelector("#menu")!

    menu.dispatchEvent(new Event("mouseenter"))
    expect(state.getState("open")).toBe(true)

    actions.stop()

    menu.dispatchEvent(new Event("mouseleave"))
    expect(state.getState("open")).toBe(true)

    actions = new Actions(state)
    actions.start(document.body)
  })

  test("a string set is typed by the declaration", () => {
    click("#tab-a")

    expect(state.getState("sort")).toBe("name")
  })

  test("single quotes protect separators", () => {
    click("#quoted")

    expect(state.getState("sort")).toBe("hello, world")
  })

  test("a form defaults to submit, not click", () => {
    expect(state.getState("pending")).toBe(false)

    const form = document.querySelector("#form")!

    form.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    expect(state.getState("pending")).toBe(false)

    form.dispatchEvent(new Event("submit", { bubbles: true }))
    expect(state.getState("pending")).toBe(true)
  })

  test("a select defaults to change and $value reads the target", () => {
    const select = document.querySelector<HTMLSelectElement>("#chooser")!

    select.value = "date"
    select.dispatchEvent(new Event("change", { bubbles: true }))

    expect(state.getState("sort")).toBe("date")
  })

  test("an input defaults to input", () => {
    const input = document.querySelector<HTMLInputElement>("#typer")!

    input.value = "typed"
    input.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    expect(state.getState("sort")).toBe("name")

    input.dispatchEvent(new Event("input", { bubbles: true }))
    expect(state.getState("sort")).toBe("typed")
  })

  test("an explicit event overrides the element default", () => {
    const input = document.querySelector<HTMLInputElement>("#draft-input")!

    state.setState({ sort: "changed" })
    input.dispatchEvent(new Event("input", { bubbles: true }))
    expect(state.getState("sort")).toBe("changed")

    input.dispatchEvent(new FocusEvent("blur"))
    expect(state.getState("sort")).toBe("name")
  })

  test("mouseenter and mouseleave drive a dropdown without bubbling", () => {
    const menu = document.querySelector("#menu")!

    menu.dispatchEvent(new MouseEvent("mouseenter"))
    expect(state.getState("open")).toBe(true)

    menu.dispatchEvent(new MouseEvent("mouseleave"))
    expect(state.getState("open")).toBe(false)
  })

  test("a button inside a row toggles that row's state and no other", () => {
    document.querySelector("#a .star")!.dispatchEvent(new MouseEvent("click", { bubbles: true }))

    expect(document.querySelector("#a em")?.textContent).toContain("starred")
    expect(document.querySelector("#b em")?.textContent).toContain("plain")
  })

  test("a second row's button resolves its own scope, not the one the last run pinned", () => {
    click("#a .star")

    expect(document.querySelector("#a em")?.textContent).toContain("starred")

    click("#b .star")

    expect(document.querySelector("#b em")?.textContent).toContain("starred")
    expect(document.querySelector("#a em")?.textContent).toContain("starred")
  })

  test("a dynamically added element works through delegation", () => {
    const late = document.createElement("button")

    late.id = "late"
    late.setAttribute("data-herb-toggle", "open")
    document.querySelector("section")!.append(late)

    click("#late")

    expect(state.getState("open")).toBe(true)
  })

  test("invalid syntax is reported at scan, before any event", async () => {
    const entries: { code: string }[] = []

    ;(window as unknown as { HerbDevTools?: unknown }).HerbDevTools = {
      report: (input: unknown) => entries.push(input as { code: string }),
    }

    const section = document.querySelector("section")!
    const bad = document.createElement("button")

    bad.setAttribute("data-herb-set", "pending")
    section.append(bad)

    const unquoted = document.createElement("button")

    unquoted.setAttribute("data-herb-set", "sort='oops")
    section.append(unquoted)

    const unknown = document.createElement("button")

    unknown.setAttribute("data-herb-toggle", "missing")
    section.append(unknown)

    const mistyped = document.createElement("button")

    mistyped.setAttribute("data-herb-increment", "sort")
    section.append(mistyped)

    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(entries.map((entry) => entry.code)).toEqual([
      "herb-invalid-action",
      "herb-invalid-action",
      "herb-unknown-state",
      "herb-state-type",
    ])

    delete (window as unknown as { HerbDevTools?: unknown }).HerbDevTools
  })

  test("a valid page reports nothing at scan", () => {
    const entries: unknown[] = []

    ;(window as unknown as { HerbDevTools?: unknown }).HerbDevTools = {
      report: (input: unknown) => entries.push(input),
    }

    actions.stop()
    actions = new Actions(state)
    actions.start(document.body)

    expect(entries).toEqual([])

    delete (window as unknown as { HerbDevTools?: unknown }).HerbDevTools
  })

  test("toggle on a non-boolean reports and does nothing", () => {
    const entries: unknown[] = []

    ;(window as unknown as { HerbDevTools?: unknown }).HerbDevTools = {
      report: (input: unknown) => entries.push(input),
    }

    const rogue = document.createElement("button")

    rogue.setAttribute("data-herb-toggle", "sort")
    document.querySelector("section")!.append(rogue)
    rogue.dispatchEvent(new MouseEvent("click", { bubbles: true }))

    expect(state.getState("open")).toBe(false)
    expect((entries[0] as { code: string }).code).toBe("herb-state-type")

    delete (window as unknown as { HerbDevTools?: unknown }).HerbDevTools
  })
})

describe("a tag helper input bound to a state", () => {
  const HELPER_FILE = "app/views/page/show.html.erb"

  const HELPER_PAGE =
    `<!--herb-region:${HELPER_FILE}:57899424:0-->` +
    `<input value="" data-herb-slot="0:attribute:value">` +
    `<button id="quoted" data-herb-set="draft='abc'">Set</button>` +
    `<p data-herb-slot="1:child"></p>` +
    `<!--/herb-region:${HELPER_FILE}-->` +
    `<template data-herb-dependencies>${JSON.stringify({
      state: {},
      params: {},
      states: {
        [HELPER_FILE]: {
          version: "57899424",
          declarations: [{ name: "draft", kind: "string", default: '""', derived: null, line: 2, column: 0, scope: "region" }],
          reads: { draft: [0, 1] },
          bound: { draft: [0] },
          conditionals: {},
          presence: {},
        },
      },
    })}</template>`

  test("a quoted set writes the value into the input", () => {
    document.body.innerHTML = HELPER_PAGE

    const helperSlots = new Slots()
    helperSlots.scan(document.body)

    const helperState = new State(helperSlots, {})
    helperState.adopt()
    helperState.observe()

    const helperActions = new Actions(helperState)
    helperActions.start(document.body)

    document.querySelector<HTMLElement>("#quoted")!.dispatchEvent(new MouseEvent("click", { bubbles: true }))

    const input = document.querySelector<HTMLInputElement>("input")!

    expect(helperState.getState("draft")).toBe("abc")
    expect(input.getAttribute("value")).toBe("abc")
    expect(input.value).toBe("abc")
    expect(document.querySelector("p")?.textContent).toBe("abc")

    helperActions.stop()
    helperState.disconnect()
  })
})

const SWAP_FILE = "app/views/page/swap.html.erb"

const SWAP_PAGE =
  `<!--herb-region:${SWAP_FILE}:cccccccc:0-->` +
  `<div><!--herb-slot:0:conditional--><!--herb-branch:0:0-->` +
  `<button id="cancel" data-herb-set="editing=false" data-herb-reset="draft">Cancel</button>` +
  `<!--/herb-slot:0--></div>` +
  `<template data-herb-region="${SWAP_FILE}:cccccccc">` +
  `<!--herb-branch:0:0--><button id="cancel" data-herb-set="editing=false" data-herb-reset="draft">Cancel</button>` +
  `</template>` +
  `<!--/herb-region:${SWAP_FILE}-->` +
  `<template data-herb-dependencies>${JSON.stringify({
    state: {},
    states: {
      [SWAP_FILE]: {
        version: "cccccccc",
        declarations: [
          { name: "editing", kind: "boolean", default: "true", scope: "region" },
          { name: "draft", kind: "string", default: '"original"', scope: "region" },
        ],
        reads: {},
        conditionals: { 0: { arms: [["editing", null, 0]], else: null } },
      },
    },
  })}</template>`

describe("an action on an element its own sibling action removes", () => {
  test("the later action still resolves the scope the element had", () => {
    document.body.innerHTML = SWAP_PAGE

    const swapSlots = new Slots()

    swapSlots.scan(document.body)

    const swapState = new State(swapSlots, {
      transport: () => {
        throw new Error("a declared state must never reach the transport")
      },
    })

    swapState.adopt()

    const actions = new Actions(swapState)

    actions.start(document.body)
    swapState.setState({ draft: "typed" })

    document.getElementById("cancel")!.click()

    const scope = swapState.scopeFor(document.querySelector("div")!)!

    expect(swapState.getState("editing", { scope })).toBe(false)
    expect(swapState.getState("draft", { scope })).toBe("original")

    actions.stop()
  })
})

describe("an action attribute that is rewritten", () => {
  test("runs what the attribute says now, not what it said when it was scanned", async () => {
    document.body.innerHTML = PAGE

    const rewriteSlots = new Slots()
    rewriteSlots.scan(document.body)

    const rewriteState = new State(rewriteSlots, { transport: async () => null })
    rewriteState.adopt()

    const actions = new Actions(rewriteState)
    actions.start(document.body)

    const button = document.createElement("button")

    button.setAttribute("data-herb-set", "sort=date")
    document.querySelector("section")!.appendChild(button)

    await new Promise((resolve) => setTimeout(resolve, 0))

    button.click()

    expect(rewriteState.getState("sort")).toBe("date")

    button.setAttribute("data-herb-set", "sort=name")

    await new Promise((resolve) => setTimeout(resolve, 0))

    button.click()

    expect(rewriteState.getState("sort")).toBe("name")

    actions.stop()
  })
})

describe("a template the compiler refused", () => {
  const REFUSED = "app/views/page/refused.html.erb"

  const REFUSED_PAGE =
    `<!--herb-region:${REFUSED}:bbbbbbbb:0-->` +
    `<section>` +
    `<button id="refused-toggle" data-herb-toggle="open">Details</button>` +
    `<button id="refused-reset" data-herb-reset="sort">Reset</button>` +
    `</section>` +
    `<!--/herb-region:${REFUSED}-->`

  let refusedActions: Actions
  let entries: { code: string }[]

  beforeEach(() => {
    actions.stop()
    resetReport()

    document.body.innerHTML = REFUSED_PAGE
    entries = []

    ;(window as unknown as { HerbDevTools?: unknown }).HerbDevTools = {
      report: (input: unknown) => entries.push(input as { code: string }),
    }

    const refusedSlots = new Slots()

    refusedSlots.scan(document.body)

    const refusedState = new State(refusedSlots, {})

    refusedState.adopt()

    refusedActions = new Actions(refusedState)
    refusedActions.start(document.body)
  })

  afterEach(() => {
    refusedActions.stop()
    delete (window as unknown as { HerbDevTools?: unknown }).HerbDevTools
  })

  test("the page still says which template the markup came from", () => {
    const slots = new Slots()

    slots.scan(document.body)

    expect(slots.regions().map((region) => region.file)).toEqual([REFUSED])
  })

  test("says nothing about the controls inside it, because the compiler already did", () => {
    document.querySelector<HTMLElement>("#refused-toggle")!.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    document.querySelector<HTMLElement>("#refused-reset")!.dispatchEvent(new MouseEvent("click", { bubbles: true }))

    expect(entries.map((entry) => entry.code)).toEqual([])
  })
})
