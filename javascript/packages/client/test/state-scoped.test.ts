import { describe, test, expect, beforeEach, vi } from "vitest"
import { SlotIndex } from "../src/slot-index"
import { SlotState, STATE_EVENT } from "../src/state"

const FILE = "app/views/page/chat.html.erb"

function regionMarkup(occurrence: number): string {
  return (
    `<!--herb-region:${FILE}:aaaaaaaa:${occurrence}-->` +
    `<div><!--herb-slot:0:conditional--><!--herb-branch:0:2-->Sent<!--/herb-slot:0--></div>` +
    `<aside><!--herb-slot:7:conditional--><!--herb-branch:7:0-->Idle<!--/herb-slot:7--></aside>` +
    `<footer><!--herb-slot:8:conditional--><!--herb-branch:8:1-->Few<!--/herb-slot:8--></footer>` +
    `<video data-herb-slot="9:boolean_attribute:muted"></video>` +
    `<b><!--herb-slot:10:conditional--><!--herb-branch:10:0-->Named<!--/herb-slot:10--></b>` +
    `<i><!--herb-slot:11:conditional--><!--herb-branch:11:1-->Behind<!--/herb-slot:11--></i>` +
    `<p><!--herb-slot:1-->0<!--/herb-slot:1--></p>` +
    `<ul><!--herb-slot:2:collection-->` +
    `<!--herb-item:2:a--><li id="a" data-herb-slot="3:attribute:id"><span data-herb-slot="4:conditional"><!--herb-branch:4:1-->plain</span></li><!--/herb-item:2-->` +
    `<!--herb-item:2:b--><li id="b" data-herb-slot="3:attribute:id"><span data-herb-slot="4:conditional"><!--herb-branch:4:1-->plain</span></li><!--/herb-item:2-->` +
    `<!--/herb-slot:2--></ul>` +
    `<template data-herb-region="${FILE}:aaaaaaaa">` +
    `<!--herb-branch:0:0-->Sending…<!--herb-branch:0:1-->Not sent<!--herb-branch:0:2-->Sent` +
    `<!--herb-branch:7:1-->Busy` +
    `<!--herb-branch:8:0-->Many` +
    `<!--herb-branch:10:1-->Dated` +
    `<!--herb-branch:11:0-->Ahead` +
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
        { name: "sort", kind: "string", default: '"name"', scope: "region" },
        { name: "counter1", kind: "integer", default: "0", scope: "region" },
        { name: "counter2", kind: "integer", default: "5", scope: "region" },
      ],
      reads: { attempts: [1] },
      conditionals: {
        0: { arms: [["pending", null, 0], ["failed", null, 1]], else: 2 },
        4: { arms: [["starred", null, 0]], else: 1 },
        7: { arms: [["pending", null, 1]], else: 0 },
        8: { arms: [["attempts", "3", 0, ">"]], else: 1 },
        10: { arms: [["sort", '"date"', 0, "!="]], else: 1 },
        11: { arms: [["counter1", { state: "counter2" }, 0, ">"]], else: 1 },
      },
      presence: { 9: ["attempts", "2", ">="] },
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

describe("a state read in an interpolated attribute", () => {
  const ROW_FILE = "app/views/page/rows.html.erb"

  const ROW_PAGE =
    `<!--herb-region:${ROW_FILE}:dddddddd:0-->` +
    `<div class="row-" data-herb-slot="0:attribute_interpolation:class">x</div>` +
    `<template data-herb-region="${ROW_FILE}:dddddddd">` +
    `<!--herb-branch:0:parts-->row-<!--herb-part-->` +
    `</template>` +
    `<!--/herb-region:${ROW_FILE}-->`

  const ROW_MANIFEST = {
    state: {},
    states: {
      [ROW_FILE]: {
        version: "dddddddd",
        declarations: [{ name: "status", kind: "string", default: '""', scope: "region" }],
        reads: { status: [0] },
        conditionals: {},
      },
    },
  }

  test("a state write rebuilds the whole attribute from its parts", () => {
    document.body.innerHTML = ROW_PAGE + `<template data-herb-dependencies>${JSON.stringify(ROW_MANIFEST)}</template>`

    const rowSlots = new SlotIndex()

    rowSlots.scan(document.body)

    const rowState = new SlotState(rowSlots, {
      persist: "none",
      transport: () => {
        throw new Error("a declared state must never reach the transport")
      },
    })

    rowState.adopt()

    expect(rowState.setState({ status: "busy" })).toBe(true)
    expect(document.querySelector("div")?.className).toBe("row-busy")

    expect(rowState.setState({ status: "" })).toBe(true)
    expect(document.querySelector("div")?.className).toBe("row-")
  })
})

describe("sibling collections sharing a state name", () => {
  const TWIN_FILE = "app/views/page/twins.html.erb"

  const TWIN_PAGE =
    `<!--herb-region:${TWIN_FILE}:cccccccc:0-->` +
    `<ul><!--herb-slot:0:collection-->` +
    `<!--herb-item:0:a--><li id="left-a"><span data-herb-slot="1:conditional"><!--herb-branch:1:1-->plain</span></li><!--/herb-item:0-->` +
    `<!--/herb-slot:0--></ul>` +
    `<ul><!--herb-slot:5:collection-->` +
    `<!--herb-item:5:a--><li id="right-a"><span data-herb-slot="6:conditional"><!--herb-branch:6:1-->plain</span></li><!--/herb-item:5-->` +
    `<!--/herb-slot:5--></ul>` +
    `<template data-herb-region="${TWIN_FILE}:cccccccc">` +
    `<!--herb-branch:1:0-->starred<!--herb-branch:1:1-->plain` +
    `<!--herb-branch:6:0-->starred<!--herb-branch:6:1-->plain` +
    `</template>` +
    `<!--/herb-region:${TWIN_FILE}-->`

  const TWIN_MANIFEST = {
    state: {},
    states: {
      [TWIN_FILE]: {
        version: "cccccccc",
        declarations: [
          { name: "starred", kind: "boolean", default: "false", scope: 0 },
          { name: "starred", kind: "boolean", default: "false", scope: 5 },
        ],
        reads: {},
        conditionals: {
          1: { arms: [["starred", null, 0]], else: 1 },
          6: { arms: [["starred", null, 0]], else: 1 },
        },
      },
    },
  }

  test("a write in one collection leaves the other alone", () => {
    document.body.innerHTML = TWIN_PAGE + `<template data-herb-dependencies>${JSON.stringify(TWIN_MANIFEST)}</template>`

    const twinSlots = new SlotIndex()

    twinSlots.scan(document.body)

    const twinState = new SlotState(twinSlots, {
      persist: "none",
      transport: () => {
        throw new Error("a declared state must never reach the transport")
      },
    })

    twinState.adopt()

    const scope = twinState.scopeFor(document.querySelector("#left-a")!, "starred")!

    expect(twinState.setState({ starred: true }, { scope })).toBe(true)

    expect(document.querySelector("#left-a")?.textContent).toContain("starred")
    expect(document.querySelector("#right-a")?.textContent).toBe("plain")
  })
})

describe("declared state", () => {
  test("a burst of state writes does not evict held revert tokens", () => {
    const report = slots.apply({ template: FILE, version: "aaaaaaaa", occurrence: 0, slots: { 1: "9" } })

    for (let step = 0; step < 60; step += 1) state.setState({ attempts: step })

    expect(slots.revert(report.token!)).toBe(true)
  })

  test("a state compares against another state, from either side", () => {
    expect(document.querySelector("i")?.textContent).toContain("Behind")

    state.setState({ counter1: 9 })
    expect(document.querySelector("i")?.textContent).toContain("Ahead")

    state.setState({ counter2: 12 })
    expect(document.querySelector("i")?.textContent).toContain("Behind")
  })

  test("a negated equality arm matches everything but its literal", () => {
    expect(document.querySelector("b")?.textContent).toContain("Named")

    state.setState({ sort: "date" })
    expect(document.querySelector("b")?.textContent).toContain("Dated")

    state.setState({ sort: "title" })
    expect(document.querySelector("b")?.textContent).toContain("Named")
  })

  test("an ordered arm flips at its boundary", () => {
    expect(document.querySelector("footer")?.textContent).toContain("Few")

    state.setState({ attempts: 4 })
    expect(document.querySelector("footer")?.textContent).toContain("Many")
    expect(document.querySelector("video")?.hasAttribute("muted")).toBe(true)

    state.setState({ attempts: 1 })
    expect(document.querySelector("footer")?.textContent).toContain("Few")
    expect(document.querySelector("video")?.hasAttribute("muted")).toBe(false)
  })

  test("an unless conditional flips through its inverted arms", () => {
    expect(document.querySelector("aside")?.textContent).toContain("Idle")

    expect(state.setState({ pending: true })).toBe(true)
    expect(document.querySelector("aside")?.textContent).toContain("Busy")

    expect(state.setState({ pending: false })).toBe(true)
    expect(document.querySelector("aside")?.textContent).toContain("Idle")
  })

  test("a scoped write to a region state reaches the region", () => {
    const scope = state.scopeFor(document.querySelector("#a")!)!

    expect(state.setState({ pending: true }, { scope })).toBe(true)

    expect(state.getState("pending")).toBe(true)
    expect(document.querySelector("div")?.textContent).toContain("Sending…")
  })

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

describe("combo conditions", () => {
  const COMBO_FILE = "app/views/page/combos.html.erb"

  const COMBO_PAGE =
    `<!--herb-region:${COMBO_FILE}:eeeeeeee:0-->` +
    `<div><!--herb-slot:0:conditional--><!--herb-branch:0:1-->Out<!--/herb-slot:0--></div>` +
    `<span><!--herb-slot:1:conditional--><!--herb-branch:1:1-->Idle<!--/herb-slot:1--></span>` +
    `<input data-herb-slot="2:boolean_attribute:disabled">` +
    `<b><!--herb-slot:3:conditional--><!--herb-branch:3:1-->Calm<!--/herb-slot:3--></b>` +
    `<template data-herb-region="${COMBO_FILE}:eeeeeeee">` +
    `<!--herb-branch:0:0-->In<!--herb-branch:0:1-->Out` +
    `<!--herb-branch:1:0-->Busy<!--herb-branch:1:1-->Idle` +
    `<!--herb-branch:3:0-->Stuck<!--herb-branch:3:1-->Calm` +
    `</template>` +
    `<!--/herb-region:${COMBO_FILE}-->`

  const COMBO_MANIFEST = {
    state: {},
    states: {
      [COMBO_FILE]: {
        version: "eeeeeeee",
        declarations: [
          { name: "counter1", kind: "integer", default: "0", scope: "region" },
          { name: "counter2", kind: "integer", default: "5", scope: "region" },
          { name: "pending", kind: "boolean", default: "false", scope: "region" },
          { name: "failed", kind: "boolean", default: "false", scope: "region" },
          { name: "attempts", kind: "integer", default: "0", scope: "region" },
        ],
        reads: {},
        conditionals: {
          0: { arms: [{ branch: 0, all: [["counter1", "0", ">"], ["counter2", "10", "<"]] }], else: 1 },
          1: { arms: [{ branch: 0, any: [["pending", null], ["failed", null]] }], else: 1 },
          3: { arms: [{ branch: 0, all: [["pending", null], { any: [["failed", null], ["attempts", "2", ">"]] }] }], else: 1 },
        },
        presence: { 2: { any: [["pending", null], ["failed", null]] } },
      },
    },
  }

  let comboState: SlotState

  beforeEach(() => {
    document.body.innerHTML = COMBO_PAGE + `<template data-herb-dependencies>${JSON.stringify(COMBO_MANIFEST)}</template>`

    const comboSlots = new SlotIndex()

    comboSlots.scan(document.body)

    comboState = new SlotState(comboSlots, {
      persist: "none",
      transport: () => {
        throw new Error("a declared state must never reach the transport")
      },
    })

    comboState.adopt()
  })

  test("an all combo needs every condition and reacts to each state", () => {
    expect(comboState.setState({ counter1: 3 })).toBe(true)
    expect(document.querySelector("div")?.textContent).toContain("In")

    expect(comboState.setState({ counter2: 12 })).toBe(true)
    expect(document.querySelector("div")?.textContent).toContain("Out")

    expect(comboState.setState({ counter2: 5 })).toBe(true)
    expect(document.querySelector("div")?.textContent).toContain("In")
  })

  test("an any combo flips on either state", () => {
    expect(comboState.setState({ failed: true })).toBe(true)
    expect(document.querySelector("span")?.textContent).toContain("Busy")

    expect(comboState.setState({ failed: false })).toBe(true)
    expect(document.querySelector("span")?.textContent).toContain("Idle")

    expect(comboState.setState({ pending: true })).toBe(true)
    expect(document.querySelector("span")?.textContent).toContain("Busy")
  })

  test("a combo presence toggles the attribute from either state", () => {
    const input = document.querySelector("input")!

    expect(input.hasAttribute("disabled")).toBe(false)

    comboState.setState({ failed: true })
    expect(input.hasAttribute("disabled")).toBe(true)

    comboState.setState({ failed: false })
    expect(input.hasAttribute("disabled")).toBe(false)

    comboState.setState({ pending: true })
    expect(input.hasAttribute("disabled")).toBe(true)
  })

  test("a nested combo resolves its grouping", () => {
    comboState.setState({ pending: true })
    expect(document.querySelector("b")?.textContent).toContain("Calm")

    comboState.setState({ attempts: 3 })
    expect(document.querySelector("b")?.textContent).toContain("Stuck")

    comboState.setState({ pending: false })
    expect(document.querySelector("b")?.textContent).toContain("Calm")
  })
})

describe("derived states", () => {
  const DERIVED_FILE = "app/views/page/derived.html.erb"

  const DERIVED_PAGE =
    `<!--herb-region:${DERIVED_FILE}:ffffffff:0-->` +
    `<div><!--herb-slot:0:conditional--><!--herb-branch:0:1-->Idle<!--/herb-slot:0--></div>` +
    `<p><!--herb-slot:1-->0<!--/herb-slot:1--></p>` +
    `<input data-herb-slot="2:boolean_attribute:disabled">` +
    `<b><!--herb-slot:3:conditional--><!--herb-branch:3:1-->Calm<!--/herb-slot:3--></b>` +
    `<template data-herb-region="${DERIVED_FILE}:ffffffff">` +
    `<!--herb-branch:0:0-->Busy<!--herb-branch:0:1-->Idle` +
    `<!--herb-branch:3:0-->Deep<!--herb-branch:3:1-->Calm` +
    `</template>` +
    `<!--/herb-region:${DERIVED_FILE}-->`

  const DERIVED_MANIFEST = {
    state: {},
    states: {
      [DERIVED_FILE]: {
        version: "ffffffff",
        declarations: [
          { name: "pending", kind: "boolean", default: "false", scope: "region" },
          { name: "failed", kind: "boolean", default: "false", scope: "region" },
          { name: "attempts", kind: "integer", default: "0", scope: "region" },
          { name: "busy", kind: "boolean", default: "pending || failed", derived: { any: [["pending", null], ["failed", null]] }, scope: "region" },
          { name: "total", kind: "integer", default: "attempts", derived: ["attempts", null], scope: "region" },
          { name: "deep", kind: "boolean", default: "busy && attempts > 2", derived: { all: [["busy", null], ["attempts", "2", ">"]] }, scope: "region" },
        ],
        reads: { total: [1] },
        conditionals: {
          0: { arms: [["busy", null, 0]], else: 1 },
          3: { arms: [["deep", null, 0]], else: 1 },
        },
        presence: { 2: ["busy", null] },
      },
    },
  }

  let derivedState: SlotState

  beforeEach(() => {
    document.body.innerHTML = DERIVED_PAGE + `<template data-herb-dependencies>${JSON.stringify(DERIVED_MANIFEST)}</template>`

    const derivedSlots = new SlotIndex()

    derivedSlots.scan(document.body)

    derivedState = new SlotState(derivedSlots, {
      persist: "none",
      transport: () => {
        throw new Error("a declared state must never reach the transport")
      },
    })

    derivedState.adopt()
  })

  test("a derived state computes from its sources", () => {
    expect(derivedState.getState("busy")).toBe(false)
    expect(derivedState.getState("total")).toBe(0)

    derivedState.setState({ pending: true })

    expect(derivedState.getState("busy")).toBe(true)
  })

  test("a source write fans out through the derivation", () => {
    derivedState.setState({ failed: true })

    expect(document.querySelector("div")?.textContent).toContain("Busy")
    expect(document.querySelector("input")?.hasAttribute("disabled")).toBe(true)

    derivedState.setState({ failed: false })

    expect(document.querySelector("div")?.textContent).toContain("Idle")
    expect(document.querySelector("input")?.hasAttribute("disabled")).toBe(false)
  })

  test("a derived value slot rewrites when its source changes", () => {
    derivedState.setState({ attempts: 5 })

    expect(document.querySelector("p")?.textContent).toContain("5")
  })

  test("a derivation cascades through another derivation", () => {
    derivedState.setState({ pending: true })

    expect(document.querySelector("b")?.textContent).toContain("Calm")

    derivedState.setState({ attempts: 3 })

    expect(document.querySelector("b")?.textContent).toContain("Deep")

    derivedState.setState({ pending: false })

    expect(document.querySelector("b")?.textContent).toContain("Calm")
  })

  test("a derived state cannot be written", () => {
    expect(derivedState.setState({ busy: true })).toBe(false)
    expect(document.querySelector("div")?.textContent).toContain("Idle")

    expect(derivedState.toggle("busy")).toBe(false)
  })

  test("a derived change announces like any other", () => {
    const names: string[] = []
    const handler = (event: Event) => names.push((event as CustomEvent).detail.name)

    document.addEventListener(STATE_EVENT, handler)
    derivedState.setState({ failed: true })
    document.removeEventListener(STATE_EVENT, handler)

    expect(names).toContain("failed")
    expect(names).toContain("busy")
  })
})
