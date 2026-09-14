import { describe, test, expect, beforeEach, afterEach } from "vitest"

import { Slots } from "@herb-tools/client"

import { reshapeRegion } from "../src/dev-server/reshape"

const FILE = "app/views/posts/index.html.erb"
const VERSION = "2d5f3da9"

const ITEM_STATICS = `<!--herb-branch:2:item--><!--herb-item:2:--><li id="" data-herb-slot="3:attribute:id 4:child"></li><!--/herb-item:2-->`

const STATIC_MARKUP = {
  before: `<h1 class="big">Hello</h1><p id="" data-herb-slot="0:attribute:id 1:child"></p><ul><!--herb-slot:2:collection--><!--/herb-slot:2--></ul>`,
  text: `<h1 class="big">Hi</h1><p id="" data-herb-slot="0:attribute:id 1:child"></p><ul><!--herb-slot:2:collection--><!--/herb-slot:2--></ul>`,
  attr: `<h1 class="bigger" data-x="1">Hello</h1><p id="" data-herb-slot="0:attribute:id 1:child"></p><ul><!--herb-slot:2:collection--><!--/herb-slot:2--></ul>`,
  inserted: `<h1 class="big">Hello</h1><hr><p id="" data-herb-slot="0:attribute:id 1:child"></p><ul><!--herb-slot:2:collection--><!--/herb-slot:2--></ul>`,
  newSlot: `<h1 class="big">Hello</h1><p id="" data-herb-slot="0:attribute:id 1:child"></p><span data-herb-slot="2:child"></span><ul><!--herb-slot:3:collection--><!--/herb-slot:3--></ul>`,
}

const ROW_STATICS = { "2:item": `<!--herb-branch:2:item--><!--herb-item:2:--><li class="row" id="" data-herb-slot="3:attribute:id 4:child"></li><!--/herb-item:2-->` }

function item(key: string): string {
  return `<!--herb-item:2:${key}--><li id="${key}" data-herb-slot="3:attribute:id 4:child">${key}</li><!--/herb-item:2-->`
}

const PAGE =
  `<!--herb-region:${FILE}:${VERSION}:0-->` +
  `<h1 class="big">Hello</h1>` +
  `<p id="post_1" data-herb-slot="0:attribute:id 1:child">Marco</p>` +
  `<ul><!--herb-slot:2:collection-->${item("a")}${item("b")}<!--/herb-slot:2--></ul>` +
  `<template data-herb-region="${FILE}:${VERSION}">${ITEM_STATICS}</template>` +
  `<!--/herb-region:${FILE}-->`

let slots: Slots
let observer: MutationObserver
let mutationCount: number

function region() {
  return slots.regionsFor(FILE)[0]
}

function observe(): void {
  mutationCount = 0
  observer = new MutationObserver((records) => { mutationCount += records.length })
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, characterData: true })
}

function settleObserver(): number {
  mutationCount += observer.takeRecords().length

  return mutationCount
}

beforeEach(() => {
  document.body.innerHTML = PAGE

  slots = new Slots()
  slots.scan(document.body)
})

afterEach(() => {
  observer?.disconnect()
  document.body.innerHTML = ""
})

const BRANCH_FILE = "app/views/posts/status.html.erb"
const BRANCH_VERSION = "2f527905"
const BRANCH_MARKUP = `<span><!--herb-slot:0:conditional--><!--/herb-slot:0--></span>`

const BRANCH_PAGE =
  `<!--herb-region:${BRANCH_FILE}:${BRANCH_VERSION}:0-->` +
  `<span><!--herb-slot:0:conditional--><!--herb-branch:0:0-->Showing everything<!--/herb-slot:0--></span>` +
  `<template data-herb-region="${BRANCH_FILE}:${BRANCH_VERSION}"><!--herb-branch:0:0-->Showing everything<!--herb-branch:0:1-->Starred only</template>` +
  `<!--/herb-region:${BRANCH_FILE}-->`

describe("reshapeRegion with changed branch statics", () => {
  test("reshapes the shown branch content in place from the pushed statics", () => {
    document.body.innerHTML = BRANCH_PAGE

    const slots = new Slots()

    slots.scan(document.body)

    const region = slots.regionsFor(BRANCH_FILE)[0]

    slots.holdStatics({ file: BRANCH_FILE, version: BRANCH_VERSION }, {
      "0:0": `<!--herb-branch:0:0-->Showing everything1`,
      "0:1": `<!--herb-branch:0:1-->Starred only`,
    })

    const reshaped = reshapeRegion(slots, region, {
      version: BRANCH_VERSION,
      staticMarkup: BRANCH_MARKUP,
      changedStatics: new Set(["0:0"]),
    })

    expect(reshaped).toBe(true)
    expect(document.body.textContent).toContain("Showing everything1")
    expect(region.slots.get(0)?.branch).toBe(0)
  })
})

describe("reshapeRegion", () => {
  test("identical markup reshapes with zero DOM mutations", () => {
    observe()

    const reshaped = reshapeRegion(slots, region(), { version: VERSION, staticMarkup: STATIC_MARKUP.before })

    expect(reshaped).toBe(true)
    expect(settleObserver()).toBe(0)
    expect(document.body.textContent).toContain("Marco")
  })

  test("a changed static text node mutates exactly once and keeps everything else", () => {
    const paragraph = document.querySelector("p")
    const rowA = document.getElementById("a")

    observe()

    const reshaped = reshapeRegion(slots, region(), { version: VERSION, staticMarkup: STATIC_MARKUP.text })

    expect(reshaped).toBe(true)
    expect(settleObserver()).toBe(1)
    expect(document.querySelector("h1")?.textContent).toBe("Hi")
    expect(document.querySelector("p")).toBe(paragraph)
    expect(document.getElementById("a")).toBe(rowA)
    expect(document.querySelector("p")?.textContent).toBe("Marco")
  })

  test("static attribute changes sync while slot-owned attributes stay untouched", () => {
    const reshaped = reshapeRegion(slots, region(), { version: VERSION, staticMarkup: STATIC_MARKUP.attr })

    expect(reshaped).toBe(true)
    expect(document.querySelector("h1")?.getAttribute("class")).toBe("bigger")
    expect(document.querySelector("h1")?.getAttribute("data-x")).toBe("1")
    expect(document.querySelector("p")?.getAttribute("id")).toBe("post_1")
  })

  test("an inserted static sibling lands without touching neighbours", () => {
    const paragraph = document.querySelector("p")

    const reshaped = reshapeRegion(slots, region(), { version: VERSION, staticMarkup: STATIC_MARKUP.inserted })

    expect(reshaped).toBe(true)
    expect(document.querySelector("hr")).not.toBeNull()
    expect(document.querySelector("p")).toBe(paragraph)
  })

  test("a reshape to a new version accepts payloads at that version", () => {
    const reshaped = reshapeRegion(slots, region(), { version: "eeeeeeee", staticMarkup: STATIC_MARKUP.before })

    expect(reshaped).toBe(true)
    expect(region().version).toBe("eeeeeeee")

    const report = slots.apply({ template: FILE, version: "eeeeeeee", occurrence: 0, slots: { 1: "Kim" } })

    expect(report.applied).toBe(1)
    expect(document.querySelector("p")?.textContent).toBe("Kim")
  })

  test("changed item statics reshape every row in place, keeping nodes and values", () => {
    const rowA = document.getElementById("a")

    slots.holdStatics({ file: FILE, version: VERSION }, ROW_STATICS)

    const reshaped = reshapeRegion(slots, region(), {
      version: VERSION,
      staticMarkup: STATIC_MARKUP.before,
      changedStatics: new Set(["2:item"]),
    })

    expect(reshaped).toBe(true)

    const rows = [...document.querySelectorAll("li")]

    expect(rows).toHaveLength(2)
    expect(rows.every((row) => row.className === "row")).toBe(true)
    expect(document.getElementById("a")).toBe(rowA)
    expect(document.getElementById("a")?.textContent).toBe("a")
    expect(document.getElementById("b")?.textContent).toBe("b")
  })

  test("a structure change returns false and mutates nothing", () => {
    observe()

    const reshaped = reshapeRegion(slots, region(), { version: "8ff76601", staticMarkup: STATIC_MARKUP.newSlot })

    expect(reshaped).toBe(false)
    expect(settleObserver()).toBe(0)
    expect(region().version).toBe(VERSION)
    expect(document.querySelector("p")?.textContent).toBe("Marco")
  })
})
