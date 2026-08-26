import { describe, test, expect, beforeEach, afterEach, vi } from "vitest"
import { SlotIndex } from "../src/slot-index"
import { SlotState, STATE_EVENT } from "../src/state"
import { resetReport } from "../src/report"
import type { RuntimeDiagnostic } from "../src/report"

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

function arm(branch: number | null, condition: unknown): unknown {
  return { branch, condition }
}

const MANIFEST = {
  state: {},
  states: {
    [FILE]: {
      version: "aaaaaaaa",
      declarations: [
        { name: "pending", kind: "boolean", default: "false", value: false, scope: "region" },
        { name: "failed", kind: "boolean", default: "false", value: false, scope: "region" },
        { name: "attempts", kind: "integer", default: "0", value: 0, scope: "region" },
        { name: "starred", kind: "boolean", default: "false", value: false, scope: 2 },
        { name: "sort", kind: "string", default: '"name"', value: "name", scope: "region" },
        { name: "counter1", kind: "integer", default: "0", value: 0, scope: "region" },
        { name: "counter2", kind: "integer", default: "5", value: 5, scope: "region" },
      ],
      reads: { attempts: [1] },
      conditionals: {
        0: { arms: [arm(0, ["pending", null]), arm(1, ["failed", null])], else: 2 },
        4: { arms: [arm(0, ["starred", null])], else: 1 },
        7: { arms: [arm(1, ["pending", null])], else: 0 },
        8: { arms: [arm(0, ["attempts", { value: 3 }, ">"])], else: 1 },
        10: { arms: [arm(0, ["sort", { value: "date" }, "!="])], else: 1 },
        11: { arms: [arm(0, ["counter1", { state: "counter2" }, ">"])], else: 1 },
      },
      presence: { 9: ["attempts", { value: 2 }, ">="] },
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
    `<!--/herb-region:${ROW_FILE}-->` +
    `<template data-herb-manifests>${JSON.stringify({
      [`${ROW_FILE}:dddddddd`]: { file: ROW_FILE, identifier: ROW_FILE, version: "dddddddd", names: {}, parts: { 0: ["row-", ""] }, states: null },
    })}</template>`

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
          { name: "starred", kind: "boolean", default: "false", value: false, scope: 0 },
          { name: "starred", kind: "boolean", default: "false", value: false, scope: 5 },
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
    const { token } = slots.transaction(() => slots.apply({ template: FILE, version: "aaaaaaaa", occurrence: 0, slots: { 1: "9" } }))

    for (let step = 0; step < 60; step += 1) state.setState({ attempts: step })

    expect(slots.revert(token!)).toBe(true)
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
          { name: "counter1", kind: "integer", default: "0", value: 0, scope: "region" },
          { name: "counter2", kind: "integer", default: "5", value: 5, scope: "region" },
          { name: "pending", kind: "boolean", default: "false", value: false, scope: "region" },
          { name: "failed", kind: "boolean", default: "false", value: false, scope: "region" },
          { name: "attempts", kind: "integer", default: "0", value: 0, scope: "region" },
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
          { name: "pending", kind: "boolean", default: "false", value: false, scope: "region" },
          { name: "failed", kind: "boolean", default: "false", value: false, scope: "region" },
          { name: "attempts", kind: "integer", default: "0", value: 0, scope: "region" },
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

describe("counted states", () => {
  const COUNT_FILE = "app/views/page/counts.html.erb"

  const COUNT_PAGE =
    `<!--herb-region:${COUNT_FILE}:cafe1234:0-->` +
    `<ul><!--herb-slot:0:collection-->` +
    `<!--herb-item:0:a--><li id="a"><i><!--herb-slot:1:conditional--><!--herb-branch:1:1-->plain<!--/herb-slot:1--></i></li><!--/herb-item:0-->` +
    `<!--herb-item:0:b--><li id="b"><i><!--herb-slot:1:conditional--><!--herb-branch:1:1-->plain<!--/herb-slot:1--></i></li><!--/herb-item:0-->` +
    `<!--/herb-slot:0--></ul>` +
    `<p><!--herb-slot:2-->0<!--/herb-slot:2--></p>` +
    `<b><!--herb-slot:4:conditional--><!--herb-branch:4:1-->None<!--/herb-slot:4--></b>` +
    `<template data-herb-region="${COUNT_FILE}:cafe1234">` +
    `<!--herb-branch:0:item--><!--herb-item:0:--><li id=""><i><!--herb-slot:1:conditional--><!--/herb-slot:1--></i></li><!--/herb-item:0-->` +
    `<!--herb-branch:1:0-->starred<!--herb-branch:1:1-->plain` +
    `<!--herb-branch:4:0-->Some<!--herb-branch:4:1-->None` +
    `</template>` +
    `<!--/herb-region:${COUNT_FILE}-->`

  const COUNT_MANIFEST = {
    state: {},
    states: {
      [COUNT_FILE]: {
        version: "cafe1234",
        declarations: [
          { name: "pending", kind: "boolean", default: "false", value: false, scope: 0 },
          { name: "pending_count", kind: "integer", default: "0", value: 0, count: { collection: 0, when: ["pending", null], by: 1 }, scope: "region" },
          { name: "loud", kind: "boolean", default: "pending_count > 0", derived: ["pending_count", "0", ">"], scope: "region" },
        ],
        reads: { pending_count: [2] },
        conditionals: {
          1: { arms: [["pending", null, 0]], else: 1 },
          4: { arms: [["loud", null, 0]], else: 1 },
        },
      },
    },
  }

  let countSlots: SlotIndex
  let countState: SlotState

  beforeEach(() => {
    document.body.innerHTML = COUNT_PAGE + `<template data-herb-dependencies>${JSON.stringify(COUNT_MANIFEST)}</template>`

    countSlots = new SlotIndex()
    countSlots.scan(document.body)

    countState = new SlotState(countSlots, {
      persist: "none",
      transport: () => {
        throw new Error("a declared state must never reach the transport")
      },
    })

    countState.adopt()
  })

  function scopeOf(selector: string): NonNullable<ReturnType<SlotState["scopeFor"]>> {
    return countState.scopeFor(document.querySelector(selector)!, "pending")!
  }

  test("a count computes over the collection's items", () => {
    expect(countState.getState("pending_count")).toBe(0)

    countState.setState({ pending: true }, { scope: scopeOf("#a") })

    expect(countState.getState("pending_count")).toBe(1)
  })

  test("an item write fans out through the count and its derivations", () => {
    countState.setState({ pending: true }, { scope: scopeOf("#a") })

    expect(document.querySelector("p")?.textContent).toContain("1")
    expect(document.querySelector("b")?.textContent).toContain("Some")

    countState.setState({ pending: true }, { scope: scopeOf("#b") })

    expect(document.querySelector("p")?.textContent).toContain("2")

    countState.setState({ pending: false }, { scope: scopeOf("#a") })
    countState.setState({ pending: false }, { scope: scopeOf("#b") })

    expect(document.querySelector("p")?.textContent).toContain("0")
    expect(document.querySelector("b")?.textContent).toContain("None")
  })

  test("removing a counted item recounts", async () => {
    countState.setState({ pending: true }, { scope: scopeOf("#a") })

    expect(document.querySelector("p")?.textContent).toContain("1")

    const collection = countSlots.slot(COUNT_FILE, 0)!

    expect(countSlots.removeItem(collection, "a")).toBe(true)

    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(document.querySelector("p")?.textContent).toContain("0")
    expect(document.querySelector("b")?.textContent).toContain("None")
  })

  test("an added item joins the count once its state turns on", () => {
    const collection = countSlots.slot(COUNT_FILE, 0)!

    expect(countSlots.addItem(collection, "c")).not.toBeNull()
    expect(countState.getState("pending_count")).toBe(0)

    countState.setState({ pending: true }, { scope: countState.scopeFor(document.querySelectorAll("li")[2]!, "pending")! })

    expect(document.querySelector("p")?.textContent).toContain("1")
  })

  test("a counted state cannot be written", () => {
    expect(countState.setState({ pending_count: 5 })).toBe(false)
    expect(document.querySelector("p")?.textContent).toContain("0")
  })
})

describe("shipped seeds", () => {
  const SEED_FILE = "app/views/page/seeds.html.erb"

  const SEED_PAGE =
    `<!--herb-region:${SEED_FILE}:0a1b2c3d:0-->` +
    `<!--herb-seeds:{"open":true,"label":"a-\\u002db"}-->` +
    `<div><!--herb-slot:0:conditional--><!--herb-branch:0:0-->Busy<!--/herb-slot:0--></div>` +
    `<ul><!--herb-slot:1:collection-->` +
    `<!--herb-item:1:a--><!--herb-seeds:{"pending":true}--><li id="a"><i><!--herb-slot:2:conditional--><!--herb-branch:2:0-->sending<!--/herb-slot:2--></i></li><!--/herb-item:1-->` +
    `<!--herb-item:1:b--><!--herb-seeds:{"pending":false}--><li id="b"><i><!--herb-slot:2:conditional--><!--herb-branch:2:1-->sent<!--/herb-slot:2--></i></li><!--/herb-item:1-->` +
    `<!--/herb-slot:1--></ul>` +
    `<template data-herb-region="${SEED_FILE}:0a1b2c3d">` +
    `<!--herb-branch:0:0-->Busy<!--herb-branch:0:1-->Idle` +
    `<!--herb-branch:2:0-->sending<!--herb-branch:2:1-->sent` +
    `</template>` +
    `<!--/herb-region:${SEED_FILE}-->`

  const SEED_MANIFEST = {
    state: {},
    states: {
      [SEED_FILE]: {
        version: "0a1b2c3d",
        declarations: [
          { name: "open", kind: "boolean", default: "open_initially", scope: "region" },
          { name: "label", kind: "seeded", default: "@label", scope: "region" },
          { name: "failed", kind: "boolean", default: "false", value: false, scope: "region" },
          { name: "pending", kind: "boolean", default: "message.odd?", scope: 1 },
        ],
        reads: {},
        conditionals: {
          0: { arms: [{ branch: 0, any: [["open", null], ["failed", null]] }], else: 1 },
          2: { arms: [["pending", null, 0]], else: 1 },
        },
      },
    },
  }

  let seedSlots: SlotIndex
  let seedState: SlotState

  beforeEach(() => {
    document.body.innerHTML = SEED_PAGE + `<template data-herb-dependencies>${JSON.stringify(SEED_MANIFEST)}</template>`

    seedSlots = new SlotIndex()
    seedSlots.scan(document.body)

    seedState = new SlotState(seedSlots, {
      persist: "none",
      transport: () => {
        throw new Error("a declared state must never reach the transport")
      },
    })

    seedState.adopt()
  })

  test("the scanner attaches seeds to the region and to each item", () => {
    const region = seedSlots.regions()[0]!
    const collection = region.slots.get(1)!

    expect(region.seeds).toEqual({ open: true, label: "a--b" })
    expect(collection.items.get("a")?.seeds).toEqual({ pending: true })
    expect(collection.items.get("b")?.seeds).toEqual({ pending: false })
  })

  test("a seed the DOM cannot reveal still seeds from the channel", () => {
    expect(seedState.getState("open")).toBe(true)
    expect(seedState.getState("label")).toBe("a--b")

    seedState.setState({ failed: true })
    seedState.setState({ failed: false })

    expect(document.querySelector("div")?.textContent).toContain("Busy")
  })

  test("item seeds resolve per item", () => {
    const a = seedState.scopeFor(document.querySelector("#a")!, "pending")!
    const b = seedState.scopeFor(document.querySelector("#b")!, "pending")!

    expect(seedState.getState("pending", { scope: a })).toBe(true)
    expect(seedState.getState("pending", { scope: b })).toBe(false)
  })

  test("reset returns to the shipped value", () => {
    seedState.setState({ open: false })

    expect(seedState.getState("open")).toBe(false)

    seedState.reset("open")

    expect(seedState.getState("open")).toBe(true)
  })
})

describe("shipped seeds that disagree with the declaration", () => {
  const ODD_FILE = "app/views/page/odd-seeds.html.erb"

  interface FakeDevTools {
    report(input: RuntimeDiagnostic | RuntimeDiagnostic[]): void
    entries: RuntimeDiagnostic[]
  }

  let devTools: FakeDevTools

  function boot(seeds: string, declarations: Record<string, unknown>[]): SlotState {
    document.body.innerHTML =
      `<!--herb-region:${ODD_FILE}:0ddc0ffe:0-->` +
      `<!--herb-seeds:${seeds}-->` +
      `<p><!--herb-slot:0-->0<!--/herb-slot:0--></p>` +
      `<!--/herb-region:${ODD_FILE}-->` +
      `<template data-herb-dependencies>${JSON.stringify({
        state: {},
        states: { [ODD_FILE]: { version: "0ddc0ffe", declarations, reads: {}, conditionals: {} } },
      })}</template>`

    const oddSlots = new SlotIndex()
    oddSlots.scan(document.body)

    const oddState = new SlotState(oddSlots, { persist: "none" })
    oddState.adopt()

    return oddState
  }

  beforeEach(() => {
    resetReport()
    devTools = { entries: [], report(input) { devTools.entries.push(...(Array.isArray(input) ? input : [input])) } }
    ;(window as unknown as { HerbDevTools?: FakeDevTools }).HerbDevTools = devTools
  })

  afterEach(() => {
    delete (window as unknown as { HerbDevTools?: unknown }).HerbDevTools
  })

  test("a seed of the declared kind reports nothing", () => {
    const oddState = boot('{"count":5,"name":"x"}', [
      { name: "count", kind: "integer", default: "@count", scope: "region", line: 2, column: 0 },
      { name: "name", kind: "string", default: "@name", scope: "region", line: 2, column: 0 },
    ])

    expect(oddState.getState("count")).toBe(5)
    expect(oddState.getState("name")).toBe("x")
    expect(devTools.entries).toEqual([])
  })

  test("a seed of another kind is coerced and reported at the declaration", () => {
    const oddState = boot('{"count":"5","name":7,"open":"yes"}', [
      { name: "count", kind: "integer", default: "@count", scope: "region", line: 2, column: 0 },
      { name: "name", kind: "string", default: "@name", scope: "region", line: 2, column: 0 },
      { name: "open", kind: "boolean", default: "@open", scope: "region", line: 2, column: 0 },
    ])

    expect(oddState.getState("count")).toBe(5)
    expect(oddState.getState("name")).toBe("7")
    expect(oddState.getState("open")).toBe(true)

    expect(devTools.entries.map((entry) => [entry.code, entry.severity, entry.value])).toEqual([
      ["herb-state-type", "warning", "count"],
      ["herb-state-type", "warning", "name"],
      ["herb-state-type", "warning", "open"],
    ])
    expect(devTools.entries[0].message).toContain("coerced it to 5")
    expect(devTools.entries[0].location).toEqual({ start: { line: 2, column: 0 } })
  })

  test("a seed the client cannot read falls back and reports", () => {
    const oddState = boot('{"count":"five"}', [
      { name: "count", kind: "integer", default: "@count", scope: "region", line: 2, column: 0 },
    ])

    expect(oddState.getState("count")).toBeNull()
    expect(oddState.getState("count")).toBeNull()
    expect(devTools.entries).toHaveLength(1)
    expect(devTools.entries[0].message).toContain("cannot read it as one")
  })

  test("an empty channel still reports every dropped seed", () => {
    const oddState = boot("{}", [
      { name: "shape", kind: "seeded", default: "@shape", scope: "region", line: 2, column: 0 },
    ])

    expect(oddState.getState("shape")).toBeNull()
    expect(devTools.entries.map((entry) => entry.value)).toEqual(["shape"])
  })

  test("a seeded state missing from a present channel reports the dropped value", () => {
    const oddState = boot('{"name":"x"}', [
      { name: "name", kind: "string", default: "@name", scope: "region", line: 2, column: 0 },
      { name: "shape", kind: "seeded", default: "@shape", scope: "region", line: 2, column: 0 },
      { name: "count", kind: "integer", default: "0", value: 0, scope: "region", line: 2, column: 0 },
    ])

    expect(oddState.getState("shape")).toBeNull()
    expect(oddState.getState("count")).toBe(0)
    expect(devTools.entries.map((entry) => entry.value)).toEqual(["shape"])
    expect(devTools.entries[0].message).toContain("shipped no value")
  })
})

const MIXED_FILE = "app/views/page/filtered.html.erb"

const MIXED_PAGE =
  `<!--herb-region:${MIXED_FILE}:eeeeeeee:0-->` +
  `<ul><!--herb-slot:0:collection-->` +
  `<!--herb-item:0:a--><li data-herb-slot="1:boolean_attribute:hidden">first</li><!--/herb-item:0-->` +
  `<!--herb-item:0:b--><li data-herb-slot="1:boolean_attribute:hidden">second</li><!--/herb-item:0-->` +
  `<!--/herb-slot:0--></ul>` +
  `<!--/herb-region:${MIXED_FILE}-->` +
  `<template data-herb-dependencies>${JSON.stringify({
    state: {},
    states: {
      [MIXED_FILE]: {
        version: "eeeeeeee",
        declarations: [
          { name: "filter", kind: "string", default: '"all"', scope: "region" },
          { name: "starred", kind: "boolean", default: "false", value: false, scope: 0 },
        ],
        reads: {},
        conditionals: {},
        presence: { 1: { all: [["filter", '"starred"'], ["starred", "false"]] } },
      },
    },
  })}</template>`

describe("a condition reading both a region state and an item state", () => {
  test("resolves each name in its own scope, once per row", () => {
    document.body.innerHTML = MIXED_PAGE

    const mixedSlots = new SlotIndex()

    mixedSlots.scan(document.body)

    const mixedState = new SlotState(mixedSlots, {
      persist: "none",
      transport: () => {
        throw new Error("a declared state must never reach the transport")
      },
    })

    mixedState.adopt()

    const region = mixedSlots.regionsFor(MIXED_FILE)[0]
    const rows = () => [...document.querySelectorAll("li")].map((li) => li.hasAttribute("hidden"))

    expect(rows()).toEqual([false, false])

    mixedState.setState({ starred: true }, { scope: { region, item: region.slots.get(0)!.items.get("b")! } })
    mixedState.setState({ filter: "starred" }, { scope: { region, item: null } })

    expect(rows()).toEqual([true, false])

    mixedState.setState({ filter: "all" }, { scope: { region, item: null } })

    expect(rows()).toEqual([false, false])
  })

  test("a row added while the condition holds is hidden as soon as it appears", () => {
    document.body.innerHTML = MIXED_PAGE.replace(
      `<!--/herb-slot:0--></ul>`,
      `<!--/herb-slot:0--></ul>` +
        `<template data-herb-region="${MIXED_FILE}:eeeeeeee">` +
        `<!--herb-branch:0:item--><!--herb-item:0:--><li data-herb-slot="1:boolean_attribute:hidden"></li><!--/herb-item:0-->` +
        `</template>`,
    )

    const addedSlots = new SlotIndex()

    addedSlots.scan(document.body)

    const addedState = new SlotState(addedSlots, {
      persist: "none",
      transport: () => {
        throw new Error("a declared state must never reach the transport")
      },
    })

    addedState.adopt()

    const region = addedSlots.regionsFor(MIXED_FILE)[0]
    const collection = region.slots.get(0)!

    addedState.setState({ filter: "starred" }, { scope: { region, item: null } })
    addedSlots.addItem(collection, "c")

    expect(collection.items.get("c")!.slots.get(1)!.anchor.kind).toBe("element")
    expect([...document.querySelectorAll("li")].map((li) => li.hasAttribute("hidden"))).toEqual([true, true, true])

    addedSlots.apply({
      template: MIXED_FILE,
      version: "eeeeeeee",
      occurrence: 0,
      slots: { 0: { items: { a: { 1: false }, b: { 1: false }, c: { 1: false } } } },
    })

    expect([...document.querySelectorAll("li")].map((li) => li.hasAttribute("hidden"))).toEqual([true, true, true])
  })
})

describe("a collection nested inside another collection", () => {
  const NESTED_FILE = "app/views/page/nested.html.erb"

  const NESTED_PAGE =
    `<!--herb-region:${NESTED_FILE}:ffffffff:0--><ul><!--herb-slot:0:collection-->` +
    `<!--herb-item:0:g--><li><span data-herb-slot="1:child">group</span><ul><!--herb-slot:2:collection-->` +
    `<!--herb-item:2:r--><li data-herb-slot="3:child">row</li><!--/herb-item:2-->` +
    `<!--/herb-slot:2--></ul></li><!--/herb-item:0-->` +
    `<!--/herb-slot:0--></ul><!--/herb-region:${NESTED_FILE}-->`

  const NESTED_MANIFEST = {
    state: {},
    states: {
      [NESTED_FILE]: {
        version: "ffffffff",
        declarations: [
          { name: "open", kind: "boolean", default: "false", value: false, scope: 0 },
          { name: "picked", kind: "boolean", default: "false", value: false, scope: 2 },
        ],
        reads: {},
        conditionals: {},
      },
    },
  }

  let nestedSlots: SlotIndex
  let nestedState: SlotState

  beforeEach(() => {
    document.body.innerHTML = NESTED_PAGE + `<template data-herb-dependencies>${JSON.stringify(NESTED_MANIFEST)}</template>`

    nestedSlots = new SlotIndex()
    nestedSlots.scan(document.body)

    nestedState = new SlotState(nestedSlots, { persist: "none", transport: () => { throw new Error("no transport") } })
    nestedState.adopt()
  })

  test("indexes the inner collection's items under the outer item that holds them", () => {
    const outer = nestedSlots.slot(NESTED_FILE, 0)!
    const inner = outer.items.get("g")!.slots.get(2)!

    expect(inner.type).toBe("collection")
    expect([...inner.items.keys()]).toEqual(["r"])
  })

  test("resolves a state declared on the outer collection from inside the inner one", () => {
    const row = document.querySelector("[data-herb-slot='3:child']")!

    expect(nestedState.scopeFor(row, "picked")?.item?.key).toBe("r")
    expect(nestedState.scopeFor(row, "open")?.item?.key).toBe("g")
  })

  test("writes each state in the scope that declares it", () => {
    const row = document.querySelector("[data-herb-slot='3:child']")!

    nestedState.setState({ open: true }, { scope: nestedState.scopeFor(row, "open")! })
    nestedState.setState({ picked: true }, { scope: nestedState.scopeFor(row, "picked")! })

    expect(nestedState.getState("open", { scope: nestedState.scopeFor(row, "open")! })).toBe(true)
    expect(nestedState.getState("picked", { scope: nestedState.scopeFor(row, "picked")! })).toBe(true)
  })
})
