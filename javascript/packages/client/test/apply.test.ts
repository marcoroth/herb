import { describe, test, expect, beforeEach } from "vitest"

import { SlotIndex } from "../src/slot-index"
import type { Payload } from "../src/slot-index"

const FILE = "app/views/posts/index.html.erb"
const CARD = "app/views/posts/_card.html.erb"

const COND_FALSE = `<!--herb-region:${FILE}:aaaaaaaa:0--><div><!--herb-slot:0:conditional--><!--/herb-slot:0--></div><!--/herb-region:${FILE}-->`
const COND_TRUE = `<!--herb-region:${FILE}:aaaaaaaa:0--><div><!--herb-slot:0:conditional--><!--herb-branch:0:0--><b data-herb-child="1">yes</b><!--/herb-slot:0--></div><!--/herb-region:${FILE}-->`
const PARKED = `<template data-herb-region="${FILE}:aaaaaaaa"><!--herb-branch:0:1--><i data-herb-child="2">no</i></template>`

const ROWS = `<!--herb-region:${FILE}:bbbbbbbb:0--><ul><!--herb-slot:0:collection--><!--herb-row:0:1--><li data-herb-child="1">one</li><!--/herb-row:0--><!--herb-row:0:2--><li data-herb-child="1">two</li><!--/herb-row:0--><!--/herb-slot:0--></ul><!--/herb-region:${FILE}-->`

const NAMED_ROWS = `<!--herb-region:${FILE}:bbbbbbbb:0--><ul><!--herb-slot:0:collection--><!--herb-row:0:ada--><li data-herb-child="1">Ada</li><!--/herb-row:0--><!--herb-row:0:grace--><li data-herb-child="1">Grace</li><!--/herb-row:0--><!--/herb-slot:0--></ul><!--/herb-region:${FILE}-->`

const EMPTY_ROWS = `<!--herb-region:${FILE}:bbbbbbbb:0--><ul><!--herb-slot:0:collection--><!--/herb-slot:0--></ul><!--/herb-region:${FILE}-->`

const PARKED_ROW =
  `<template data-herb-region="${FILE}:bbbbbbbb"><!--herb-branch:0:row-->` +
  `<!--herb-row:0:--><li data-herb-child="1"></li><!--/herb-row:0--></template>`

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

  const keys = () => [...document.querySelectorAll("li")].map((li) => li.textContent)

  test("drops a row the payload no longer has", () => {
    const index = mounted(ROWS)

    const report = index.apply(payload(FILE, { 0: { rows: { 2: { 1: "two" } } } }, "bbbbbbbb"))

    expect(report.deferred).toEqual([])
    expect(keys()).toEqual(["two"])
  })

  test("builds a row it has never seen from one it has", () => {
    const index = mounted(ROWS)

    const report = index.apply(
      payload(FILE, { 0: { rows: { 1: { 1: "one" }, 2: { 1: "two" }, 3: { 1: "three" } } } }, "bbbbbbbb"),
    )

    expect(report.deferred).toEqual([])
    expect(keys()).toEqual(["one", "two", "three"])
    expect(index.slotInRow(FILE, 0, "3", 1)).not.toBeNull()
  })

  test("puts the rows in the order the payload asked for", () => {
    const index = mounted(NAMED_ROWS)

    index.apply(payload(FILE, { 0: { rows: { grace: { 1: "Grace" }, ada: { 1: "Ada" } } } }, "bbbbbbbb"))

    expect(keys()).toEqual(["Grace", "Ada"])
  })

  test("adds, removes and reorders in one go", () => {
    const index = mounted(NAMED_ROWS)

    const report = index.apply(
      payload(FILE, { 0: { rows: { yuki: { 1: "Yukihiro" }, ada: { 1: "Ada" } } } }, "bbbbbbbb"),
    )

    expect(report.deferred).toEqual([])
    expect(keys()).toEqual(["Yukihiro", "Ada"])
  })

  // JavaScript sorts integer-like object keys numerically, whatever order they were written in, so
  // `JSON.parse` loses the order the server sent for a collection keyed by id. Ascending is what an
  // append wants and what most collections already are, so this is a limit rather than a failure,
  // and a collection whose order matters has to be keyed by something that is not a number.
  test("cannot be told to reorder rows keyed by a number", () => {
    const index = mounted(ROWS)

    index.apply(payload(FILE, { 0: { rows: { 2: { 1: "two" }, 1: { 1: "one" } } } }, "bbbbbbbb"))

    expect(keys()).toEqual(["one", "two"])
  })

  test("builds into an empty collection from the row the server parked", () => {
    const index = mounted(EMPTY_ROWS + PARKED_ROW)

    const report = index.apply(payload(FILE, { 0: { rows: { 1: { 1: "one" } } } }, "bbbbbbbb"))

    expect(report.deferred).toEqual([])
    expect(keys()).toEqual(["one"])
    expect(index.slotInRow(FILE, 0, "1", 1)).not.toBeNull()
  })

  // The page loaded with rows, so the server parked none. Emptying it and adding one is the shortest
  // way to have neither a row to copy nor a parked one, and it is what a table does all day.
  test("builds again after every row has been deleted", () => {
    const index = mounted(ROWS)
    const empty = payload(FILE, { 0: { rows: {} } }, "bbbbbbbb")

    expect(index.apply(empty).deferred).toEqual([])
    expect(keys()).toEqual([])

    const report = index.apply(payload(FILE, { 0: { rows: { 9: { 1: "again" } } } }, "bbbbbbbb"))

    expect(report.deferred).toEqual([])
    expect(keys()).toEqual(["again"])
  })

  // A collection with rows is its own template, so the server parks one only when it rendered none.
  test("asks for a row when the collection is empty and nothing was parked", () => {
    const index = mounted(EMPTY_ROWS)

    const report = index.apply(payload(FILE, { 0: { rows: { 1: { 1: "one" } } } }, "bbbbbbbb"))

    expect(report.deferred).toEqual([
      { file: FILE, occurrence: 0, index: 0, reason: "rows", keys: ["1"] },
    ])
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
