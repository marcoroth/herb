import { describe, test, expect, beforeEach } from "vitest"

import { SlotIndex } from "../src/slot-index"
import type { Payload } from "../src/slot-index"

const FILE = "app/views/posts/index.html.erb"
const CARD = "app/views/posts/_card.html.erb"

const COND_FALSE = `<!--herb-region:${FILE}:aaaaaaaa:0--><div><!--herb-slot:0:conditional--><!--/herb-slot:0--></div><!--/herb-region:${FILE}-->`
const COND_TRUE = `<!--herb-region:${FILE}:aaaaaaaa:0--><div><!--herb-slot:0:conditional--><!--herb-branch:0:0--><b data-herb-child="1">yes</b><!--/herb-slot:0--></div><!--/herb-region:${FILE}-->`
const PARKED = `<template data-herb-region="${FILE}:aaaaaaaa"><!--herb-branch:0:1--><i data-herb-child="2">no</i></template>`

const ROWS = `<!--herb-region:${FILE}:bbbbbbbb:0--><ul><!--herb-slot:0:collection--><!--herb-row:0:1--><li data-herb-child="1">one</li><!--/herb-row:0--><!--herb-row:0:2--><li data-herb-child="1">two</li><!--/herb-row:0--><!--/herb-slot:0--></ul><!--/herb-region:${FILE}-->`

const NESTED =
  `<!--herb-region:${FILE}:cccccccc:0--><div><!--herb-slot:0-->` +
  `<!--herb-region:${CARD}:dddddddd:0--><p data-herb-child="0">inner</p><!--/herb-region:${CARD}-->` +
  `<!--/herb-slot:0--></div><!--/herb-region:${FILE}-->`

function mounted(html: string): SlotIndex {
  document.body.innerHTML = html

  const index = new SlotIndex()
  index.scan(document.body)

  return index
}

function payload(template: string, slots: Payload["slots"], version = "aaaaaaaa", occurrence = 0): Payload {
  return { template, version, occurrence, slots }
}

describe("applying values to a conditional", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
  })

  test("fills the branch that is already on the page", () => {
    const index = mounted(COND_TRUE)

    const report = index.apply(payload(FILE, { 0: { branch: 0, slots: { 1: "still yes" } } }))

    expect(report.applied).toBe(1)
    expect(index.rangeFor(index.slot(FILE, 1)!).toString()).toBe("still yes")
  })

  test("empties the position when the payload says no branch ran", () => {
    const index = mounted(COND_TRUE)

    const report = index.apply(payload(FILE, { 0: { branch: null } }))

    expect(report.applied).toBe(1)
    expect(index.slot(FILE, 0)?.branch).toBeNull()
    expect(index.rangeFor(index.slot(FILE, 0)!).toString()).toBe("")
  })

  test("builds a branch the page never had when its markup was parked", () => {
    const index = mounted(COND_FALSE + PARKED)

    const report = index.apply(payload(FILE, { 0: { branch: 1, slots: { 2: "built" } } }))

    expect(report.applied).toBe(1)
    expect(report.deferred).toEqual([])
    expect(index.slot(FILE, 0)?.branch).toBe(1)
    expect(index.rangeFor(index.slot(FILE, 2)!).toString()).toBe("built")
  })

  test("can put back the branch it replaced, without the server parking it", () => {
    const index = mounted(COND_TRUE + PARKED)

    index.apply(payload(FILE, { 0: { branch: 1, slots: { 2: "built" } } }))
    expect(index.slot(FILE, 0)?.branch).toBe(1)

    const report = index.apply(payload(FILE, { 0: { branch: 0, slots: { 1: "back" } } }))

    expect(report.deferred).toEqual([])
    expect(index.slot(FILE, 0)?.branch).toBe(0)
    expect(index.rangeFor(index.slot(FILE, 1)!).toString()).toBe("back")
  })

  test("defers a branch it has no markup for, rather than guessing", () => {
    const index = mounted(COND_FALSE)

    const report = index.apply(payload(FILE, { 0: { branch: 1, slots: { 2: "built" } } }))

    expect(report.applied).toBe(0)
    expect(report.deferred).toEqual([{ file: FILE, occurrence: 0, index: 0, reason: "branch" }])
    expect(index.rangeFor(index.slot(FILE, 0)!).toString()).toBe("")
  })
})

describe("applying values to a collection", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
  })

  test("writes into the rows the page already has", () => {
    const index = mounted(ROWS)

    const report = index.apply(
      payload(FILE, { 0: { rows: { 1: { 1: "ONE" }, 2: { 1: "TWO" } } } }, "bbbbbbbb"),
    )

    expect(report.applied).toBe(2)
    expect(report.deferred).toEqual([])
    expect(document.querySelectorAll("li")[0].textContent).toBe("ONE")
    expect(document.querySelectorAll("li")[1].textContent).toBe("TWO")
  })

  test("defers the rows it cannot build, and still fills the ones it can", () => {
    const index = mounted(ROWS)

    const report = index.apply(
      payload(FILE, { 0: { rows: { 2: { 1: "TWO" }, 3: { 1: "THREE" } } } }, "bbbbbbbb"),
    )

    expect(report.applied).toBe(1)
    expect(report.deferred).toEqual([
      { file: FILE, occurrence: 0, index: 0, reason: "rows", keys: ["3", "1"] },
    ])
    expect(document.querySelectorAll("li")[1].textContent).toBe("TWO")
  })
})

describe("applying values that came from more than one template", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
  })

  test("hands a partial's values to the partial's own region", () => {
    const index = mounted(NESTED)

    const report = index.apply(
      payload(FILE, { 0: payload(CARD, { 0: "replaced" }, "dddddddd") }, "cccccccc"),
    )

    expect(report.applied).toBe(1)
    expect(index.rangeFor(index.slot(CARD, 0)!).toString()).toBe("replaced")
  })

  test("defers a partial whose version the page no longer carries", () => {
    const index = mounted(NESTED)

    const report = index.apply(
      payload(FILE, { 0: payload(CARD, { 0: "replaced" }, "eeeeeeee") }, "cccccccc"),
    )

    expect(report.applied).toBe(0)
    expect(report.deferred).toEqual([{ file: CARD, occurrence: 0, index: null, reason: "stale-version" }])
    expect(index.rangeFor(index.slot(CARD, 0)!).toString()).toBe("inner")
  })
})

describe("applying values the page has no place for", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
  })

  test("names the slot it could not find and keeps going", () => {
    const index = mounted(COND_TRUE)

    const report = index.apply(payload(FILE, { 1: "written", 9: "nowhere" }))

    expect(report.applied).toBe(1)
    expect(report.deferred).toEqual([{ file: FILE, occurrence: 0, index: 9, reason: "no-slot" }])
  })
})
