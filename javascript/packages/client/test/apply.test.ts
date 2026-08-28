import { describe, test, expect, beforeEach } from "vitest"

import { Slots } from "../src/slots/slots"
import type { Payload } from "../src/types"

const FILE = "app/views/posts/index.html.erb"
const CARD = "app/views/posts/_card.html.erb"

const COND_FALSE = `<!--herb-region:${FILE}:aaaaaaaa:0--><div><!--herb-slot:0:conditional--><!--/herb-slot:0--></div><!--/herb-region:${FILE}-->`
const COND_TRUE = `<!--herb-region:${FILE}:aaaaaaaa:0--><div><!--herb-slot:0:conditional--><!--herb-branch:0:0--><b data-herb-slot="1:child">yes</b><!--/herb-slot:0--></div><!--/herb-region:${FILE}-->`
const PARKED = `<template data-herb-region="${FILE}:aaaaaaaa"><!--herb-branch:0:1--><i data-herb-slot="2:child">no</i></template>`

const ITEMS = `<!--herb-region:${FILE}:bbbbbbbb:0--><ul><!--herb-slot:0:collection--><!--herb-item:0:1--><li data-herb-slot="1:child">one</li><!--/herb-item:0--><!--herb-item:0:2--><li data-herb-slot="1:child">two</li><!--/herb-item:0--><!--/herb-slot:0--></ul><!--/herb-region:${FILE}-->`

const NAMED_ITEMS = `<!--herb-region:${FILE}:bbbbbbbb:0--><ul><!--herb-slot:0:collection--><!--herb-item:0:ada--><li data-herb-slot="1:child">Ada</li><!--/herb-item:0--><!--herb-item:0:grace--><li data-herb-slot="1:child">Grace</li><!--/herb-item:0--><!--/herb-slot:0--></ul><!--/herb-region:${FILE}-->`

const EMPTY_ITEMS = `<!--herb-region:${FILE}:bbbbbbbb:0--><ul><!--herb-slot:0:collection--><!--/herb-slot:0--></ul><!--/herb-region:${FILE}-->`

const PARKED_ITEM =
  `<template data-herb-region="${FILE}:bbbbbbbb"><!--herb-branch:0:item-->` +
  `<!--herb-item:0:--><li data-herb-slot="1:child"></li><!--/herb-item:0--></template>`

const NESTED =
  `<!--herb-region:${FILE}:cccccccc:0--><div><!--herb-slot:0-->` +
  `<!--herb-region:${CARD}:dddddddd:0--><p data-herb-slot="0:child">inner</p><!--/herb-region:${CARD}-->` +
  `<!--/herb-slot:0--></div><!--/herb-region:${FILE}-->`

function mounted(html: string): Slots {
  document.body.innerHTML = html

  const index = new Slots()
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
    expect(index.rangeOf(index.slot(FILE, 1)!).toString()).toBe("still yes")
  })

  test("empties the position when the payload says no branch ran", () => {
    const index = mounted(COND_TRUE)

    const report = index.apply(payload(FILE, { 0: { branch: null } }))

    expect(report.applied).toBe(1)
    expect(index.slot(FILE, 0)?.branch).toBeNull()
    expect(index.rangeOf(index.slot(FILE, 0)!).toString()).toBe("")
  })

  test("builds a branch the page never had when its markup was parked", () => {
    const index = mounted(COND_FALSE + PARKED)

    const report = index.apply(payload(FILE, { 0: { branch: 1, slots: { 2: "built" } } }))

    expect(report.applied).toBe(1)
    expect(report.deferred).toEqual([])
    expect(index.slot(FILE, 0)?.branch).toBe(1)
    expect(index.rangeOf(index.slot(FILE, 2)!).toString()).toBe("built")
  })

  test("can put back the branch it replaced, without the server parking it", () => {
    const index = mounted(COND_TRUE + PARKED)

    index.apply(payload(FILE, { 0: { branch: 1, slots: { 2: "built" } } }))
    expect(index.slot(FILE, 0)?.branch).toBe(1)

    const report = index.apply(payload(FILE, { 0: { branch: 0, slots: { 1: "back" } } }))

    expect(report.deferred).toEqual([])
    expect(index.slot(FILE, 0)?.branch).toBe(0)
    expect(index.rangeOf(index.slot(FILE, 1)!).toString()).toBe("back")
  })

  test("defers a branch it has no markup for, rather than guessing", () => {
    const index = mounted(COND_FALSE)

    const report = index.apply(payload(FILE, { 0: { branch: 1, slots: { 2: "built" } } }))

    expect(report.applied).toBe(0)
    expect(report.deferred).toEqual([{ file: FILE, occurrence: 0, index: 0, reason: "branch" }])
    expect(index.rangeOf(index.slot(FILE, 0)!).toString()).toBe("")
  })
})

describe("applying values to a collection", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
  })

  test("writes into the items the page already has", () => {
    const index = mounted(ITEMS)

    const report = index.apply(
      payload(FILE, { 0: { items: { 1: { 1: "ONE" }, 2: { 1: "TWO" } } } }, "bbbbbbbb"),
    )

    expect(report.applied).toBe(2)
    expect(report.deferred).toEqual([])
    expect(document.querySelectorAll("li")[0].textContent).toBe("ONE")
    expect(document.querySelectorAll("li")[1].textContent).toBe("TWO")
  })

  const keys = () => [...document.querySelectorAll("li")].map((li) => li.textContent)

  test("drops an item the payload no longer has", () => {
    const index = mounted(ITEMS)

    const report = index.apply(payload(FILE, { 0: { items: { 2: { 1: "two" } } } }, "bbbbbbbb"))

    expect(report.deferred).toEqual([])
    expect(keys()).toEqual(["two"])
  })

  test("builds an item it has never seen from one it has", () => {
    const index = mounted(ITEMS)

    const report = index.apply(
      payload(FILE, { 0: { items: { 1: { 1: "one" }, 2: { 1: "two" }, 3: { 1: "three" } } } }, "bbbbbbbb"),
    )

    expect(report.deferred).toEqual([])
    expect(keys()).toEqual(["one", "two", "three"])
    expect(index.slotInItem(FILE, 0, "3", 1)).not.toBeNull()
  })

  test("puts the items in the order the payload asked for", () => {
    const index = mounted(NAMED_ITEMS)

    index.apply(payload(FILE, { 0: { items: { grace: { 1: "Grace" }, ada: { 1: "Ada" } } } }, "bbbbbbbb"))

    expect(keys()).toEqual(["Grace", "Ada"])
  })

  test("adds, removes and reorders in one go", () => {
    const index = mounted(NAMED_ITEMS)

    const report = index.apply(
      payload(FILE, { 0: { items: { yuki: { 1: "Yukihiro" }, ada: { 1: "Ada" } } } }, "bbbbbbbb"),
    )

    expect(report.deferred).toEqual([])
    expect(keys()).toEqual(["Yukihiro", "Ada"])
  })

  test("orders items keyed by a number the way the payload's order names", () => {
    const index = mounted(ITEMS)

    index.apply(payload(FILE, { 0: { items: { 2: { 1: "two" }, 1: { 1: "one" } }, order: ["2", "1"] } }, "bbbbbbbb"))

    expect(keys()).toEqual(["two", "one"])
  })

  test("builds into an empty collection from the item the server parked", () => {
    const index = mounted(EMPTY_ITEMS + PARKED_ITEM)

    const report = index.apply(payload(FILE, { 0: { items: { 1: { 1: "one" } } } }, "bbbbbbbb"))

    expect(report.deferred).toEqual([])
    expect(keys()).toEqual(["one"])
    expect(index.slotInItem(FILE, 0, "1", 1)).not.toBeNull()
  })

  test("builds again after every item has been deleted", () => {
    const index = mounted(ITEMS)
    const empty = payload(FILE, { 0: { items: {} } }, "bbbbbbbb")

    expect(index.apply(empty).deferred).toEqual([])
    expect(keys()).toEqual([])

    const report = index.apply(payload(FILE, { 0: { items: { 9: { 1: "again" } } } }, "bbbbbbbb"))

    expect(report.deferred).toEqual([])
    expect(keys()).toEqual(["again"])
  })

  test("asks for an item when the collection is empty and nothing was parked", () => {
    const index = mounted(EMPTY_ITEMS)

    const report = index.apply(payload(FILE, { 0: { items: { 1: { 1: "one" } } } }, "bbbbbbbb"))

    expect(report.deferred).toEqual([
      { file: FILE, occurrence: 0, index: 0, reason: "items", keys: ["1"] },
    ])
  })
})

const BLOCK =
  `<!--herb-region:${FILE}:eeeeeeee:0--><!--herb-slot:0:block--><form><!--herb-slot:1-->Name<!--/herb-slot:1--></form><!--/herb-slot:0-->` +
  `<!--herb-slot:2-->after<!--/herb-slot:2--><!--/herb-region:${FILE}-->`

const BARE_BLOCK = `<!--herb-region:${FILE}:eeeeeeee:0--><!--herb-slot:0:block--><form>Name</form><!--/herb-slot:0--><!--/herb-region:${FILE}-->`

describe("applying values to a block", () => {
  test("writes the interior the page can address and leaves the helper's markup alone", () => {
    const index = mounted(BLOCK)

    const report = index.apply(payload(FILE, { 0: "<form>Other</form>", 1: "Other", 2: "later" }, "eeeeeeee"))

    expect(report.deferred).toEqual([])
    expect(document.querySelector("form")!.innerHTML).toBe("<!--herb-slot:1-->Other<!--/herb-slot:1-->")
    expect(index.slot(FILE, 1)).not.toBeNull()
  })

  test("says the helper's own markup went unwritten when the interior does not account for it", () => {
    const index = mounted(BLOCK)

    const report = index.apply(payload(FILE, { 0: `<form action="/posts/2">Other</form>`, 1: "Other", 2: "later" }, "eeeeeeee"))

    expect(report.deferred).toEqual([{ file: FILE, occurrence: 0, index: 0, reason: "block" }])
    expect(document.querySelector("form")!.innerHTML).toBe("<!--herb-slot:1-->Other<!--/herb-slot:1-->")
  })

  test("falls back to the whole block when its interior is not addressable", () => {
    const index = mounted(BARE_BLOCK)

    const report = index.apply(payload(FILE, { 0: "<form>Other</form>" }, "eeeeeeee"))

    expect(report.applied).toBe(1)
    expect(document.querySelector("form")!.innerHTML).toBe("Other")
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
    expect(index.rangeOf(index.slot(CARD, 0)!).toString()).toBe("replaced")
  })

  test("defers a partial whose version the page no longer carries", () => {
    const index = mounted(NESTED)

    const report = index.apply(
      payload(FILE, { 0: payload(CARD, { 0: "replaced" }, "eeeeeeee") }, "cccccccc"),
    )

    expect(report.applied).toBe(0)
    expect(report.deferred).toEqual([{ file: CARD, occurrence: 0, index: null, reason: "stale-version" }])
    expect(index.rangeOf(index.slot(CARD, 0)!).toString()).toBe("inner")
  })
})

describe("an attribute a template only partly wrote", () => {
  const PARTIAL = `<!--herb-region:${FILE}:aaaaaaaa:0--><div class="card active" data-herb-slot="0:attribute_interpolation:class"></div><!--/herb-region:${FILE}-->`

  beforeEach(() => {
    document.body.innerHTML = ""
  })

  test("is refused rather than written over", () => {
    const index = mounted(PARTIAL)

    const report = index.apply(payload(FILE, { 0: "" }))

    expect(report.applied).toBe(0)
    expect(report.deferred).toEqual([{ file: FILE, occurrence: 0, index: 0, reason: "partial-attribute" }])
    expect(document.querySelector("div")?.getAttribute("class")).toBe("card active")
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

describe("applying a value that carries entities", () => {
  const ATTRS = `<!--herb-region:${FILE}:eeeeeeee:0--><li title="old" data-herb-slot="0:attribute:title 1:child">old</li><!--/herb-region:${FILE}-->`

  const INTERPOLATED =
    `<!--herb-region:${FILE}:ffffffff:0--><li class="row-old" data-herb-slot="0:attribute_interpolation:class">x</li>` +
    `<template data-herb-manifests>${JSON.stringify({ [`${FILE}:ffffffff`]: { file: FILE, identifier: FILE, version: "ffffffff", names: {}, parts: { 0: ["row-", ""] }, states: null } })}</template>` +
    `<!--/herb-region:${FILE}-->`

  test("writes an attribute the way the server's markup reads, not the bytes it sent", () => {
    const index = mounted(ATTRS)

    index.apply(payload(FILE, { 0: "Tom &amp; &lt;b&gt;Jerry&lt;/b&gt;", 1: "Tom &amp; Jerry" }, "eeeeeeee"))

    const element = document.querySelector("li")!

    expect(element.getAttribute("title")).toBe("Tom & <b>Jerry</b>")
    expect(element.textContent).toBe("Tom & Jerry")
  })

  test("joins an interpolated attribute's parts with what the server would have written", () => {
    const index = mounted(INTERPOLATED)

    index.apply(payload(FILE, { 0: ["a &amp; b"] }, "ffffffff"))

    expect(document.querySelector("li")!.getAttribute("class")).toBe("row-a & b")
  })

  test("leaves an entity the value only looks like alone", () => {
    const index = mounted(ATTRS)

    index.apply(payload(FILE, { 0: "100% &amp; rising &nbsp" }, "eeeeeeee"))

    expect(document.querySelector("li")!.getAttribute("title")).toBe("100% & rising &nbsp")
  })
})
