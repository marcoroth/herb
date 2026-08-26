import { describe, test, expect, beforeEach } from "vitest"

import { SlotIndex } from "../src/slot-index"
import { SlotState } from "../src/state"

const FILE = "app/views/t.html.erb"
const VERSION = "9dac1733"

const MANIFEST = {
  file: FILE,
  identifier: FILE,
  version: VERSION,
  slots: [
    { index: 0, type: "attribute_interpolation", attribute: "class" },
    { index: 1, type: "attribute", attribute: "id" },
    { index: 2, type: "child" },
  ],
  names: { rows: 2 },
  parts: { 0: ["row-", "-x"] },
  states: null,
}

const PAGE =
  `<!--herb-region:${FILE}:${VERSION}:0-->` +
  `<ul><li class="row-a-x" id="a" data-herb-slot="0:attribute_interpolation:class 1:attribute:id 2:child">a</li></ul>` +
  `<!--/herb-region:${FILE}-->`

const INLINE = `<template data-herb-manifests>${JSON.stringify({ [`${FILE}:${VERSION}`]: MANIFEST })}</template>`
const HOISTED = `<template data-herb-manifests>${JSON.stringify({ [`${FILE}:${VERSION}`]: MANIFEST })}</template>`

let index: SlotIndex

function mount(markup: string): HTMLElement {
  document.body.innerHTML = ""

  const host = document.createElement("div")

  host.innerHTML = markup
  document.body.appendChild(host)

  index.scan(host)

  return host
}

beforeEach(() => {
  index = new SlotIndex()
})

describe("a manifest a template wrote beside itself", () => {
  test("answers a name the page carries nowhere else", () => {
    mount(PAGE + INLINE)

    expect(index.slot(FILE, "rows")?.index).toBe(2)
  })

  test("answers the static stretches an interpolated attribute is written around", () => {
    mount(PAGE + INLINE)

    const slot = index.slot(FILE, 0)!

    expect(index.setAttribute(slot, ["b"])).toBe(true)
    expect(document.querySelector("li")!.getAttribute("class")).toBe("row-b-x")
  })

  test("is taken off the page once it is read", () => {
    const host = mount(PAGE + INLINE)

    expect(host.querySelector("template[data-herb-manifests]")).toBeNull()
  })
})

describe("the manifests of a whole response, in one container", () => {
  test("answers for the template it names", () => {
    mount(PAGE + HOISTED)

    expect(index.slot(FILE, "rows")?.index).toBe(2)
  })

  test("is taken off the page once it is read", () => {
    const host = mount(PAGE + HOISTED)

    expect(host.querySelector("template[data-herb-manifests]")).toBeNull()
  })

  test("keeps one manifest per template and version", () => {
    const other = { ...MANIFEST, version: "eeeeeeee", names: { rows: 1 } }
    const both = { [`${FILE}:${VERSION}`]: MANIFEST, [`${FILE}:eeeeeeee`]: other }

    mount(PAGE + `<template data-herb-manifests>${JSON.stringify(both)}</template>`)

    expect(index.slot(FILE, "rows")?.index).toBe(2)
  })
})

describe("a page whose templates each wrote their own container", () => {
  const PARTIAL = "app/views/_card.html.erb"

  const PARTIAL_MANIFEST = {
    file: PARTIAL,
    identifier: PARTIAL,
    version: "bbbbbbbb",
    slots: [{ index: 0, type: "child" }],
    names: { title: 0 },
    parts: {},
    states: null,
  }

  const SEPARATE =
    `<template data-herb-manifests>${JSON.stringify({ [`${FILE}:${VERSION}`]: MANIFEST })}</template>` +
    `<template data-herb-manifests>${JSON.stringify({ [`${PARTIAL}:bbbbbbbb`]: PARTIAL_MANIFEST })}</template>`

  const NESTED = `<!--herb-region:${PARTIAL}:bbbbbbbb:0--><h1 data-herb-slot="0:child">t</h1><!--/herb-region:${PARTIAL}-->`

  test("reads every container, not just the first", () => {
    mount(PAGE + NESTED + SEPARATE)

    expect(index.slot(FILE, "rows")?.index).toBe(2)
    expect(index.slot(PARTIAL, "title")?.index).toBe(0)
  })

  test("takes all of them off the page", () => {
    const host = mount(PAGE + NESTED + SEPARATE)

    expect(host.querySelectorAll("template[data-herb-manifests]")).toHaveLength(0)
  })

  test("keeps the first answer when a container repeats one it already holds", () => {
    const contradiction = { ...MANIFEST, names: { rows: 99 } }

    mount(
      PAGE +
        `<template data-herb-manifests>${JSON.stringify({ [`${FILE}:${VERSION}`]: MANIFEST })}</template>` +
        `<template data-herb-manifests>${JSON.stringify({ [`${FILE}:${VERSION}`]: contradiction })}</template>`,
    )

    expect(index.slot(FILE, "rows")?.index).toBe(2)
  })
})

describe("a page an older server rendered", () => {
  test("still resolves a name from the attribute the compiler rewrote", () => {
    mount(
      `<!--herb-region:${FILE}:${VERSION}:0--><ul data-herb-name="2:rows">` +
        `<li data-herb-slot="2:child">a</li></ul><!--/herb-region:${FILE}-->`,
    )

    expect(index.slot(FILE, "rows")?.index).toBe(2)
  })

  test("still resolves parts from the parked markup", () => {
    mount(
      `<!--herb-region:${FILE}:${VERSION}:0-->` +
        `<li class="row-a-x" data-herb-slot="0:attribute_interpolation:class">a</li>` +
        `<template data-herb-region="${FILE}:${VERSION}"><!--herb-branch:0:parts-->row-<!--herb-part-->-x</template>` +
        `<!--/herb-region:${FILE}-->`,
    )

    const slot = index.slot(FILE, 0)!

    expect(index.setAttribute(slot, ["b"])).toBe(true)
    expect(document.querySelector("li")!.getAttribute("class")).toBe("row-b-x")
  })
})

describe("a manifest that cannot be read", () => {
  test("is ignored rather than thrown over", () => {
    const host = mount(PAGE + `<template data-herb-manifests>{not json</template>`)

    expect(index.slot(FILE, "rows")).toBeNull()
    expect(host.querySelector("template[data-herb-manifests]")).toBeNull()
  })
})

describe("what a page can be typed into, worked out without being told", () => {
  const BOUND_FILE = "app/views/form.html.erb"

  const MANIFEST_WITHOUT_BOUND = {
    version: "aaaaaaaa",
    declarations: [
      { name: "draft", kind: "string", default: '""', value: "", scope: "region" },
      { name: "hint", kind: "string", default: '""', value: "", scope: "region" },
    ],
    reads: { draft: [0], hint: [1] },
    conditionals: {},
  }

  function boot(): SlotState {
    document.body.innerHTML =
      `<!--herb-region:${BOUND_FILE}:aaaaaaaa:0-->` +
      `<input value="" data-herb-slot="0:attribute:value">` +
      `<input id="hinted" placeholder="" data-herb-slot="1:attribute:placeholder">` +
      `<!--/herb-region:${BOUND_FILE}-->` +
      `<template data-herb-dependencies>${JSON.stringify({ state: {}, states: { [BOUND_FILE]: MANIFEST_WITHOUT_BOUND } })}</template>`

    const slots = new SlotIndex()
    slots.scan(document.body)

    const state = new SlotState(slots, { persist: "none", transport: () => { throw new Error("no transport") } })
    state.adopt()
    state.observe()

    return state
  }

  test("takes an input's value slot as bound, with no bound map from the server", () => {
    const state = boot()
    const input = document.querySelector("input")!

    input.value = "typed"
    input.dispatchEvent(new Event("input", { bubbles: true }))

    expect(state.getState("draft")).toBe("typed")
  })

  test("does not bind a state read into an attribute nobody types into", () => {
    const state = boot()
    const hinted = document.querySelector("#hinted") as HTMLInputElement

    hinted.value = "typed"
    hinted.dispatchEvent(new Event("input", { bubbles: true }))

    expect(state.getState("hint")).toBe("")
  })
})
