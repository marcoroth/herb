import { describe, test, expect, beforeEach } from "vitest"
import { SlotIndex } from "../src/slot-index"
import { SLOT_EVENT } from "../src/events"

import type { SlotEventDetail } from "../src/types"

const FILE = "app/views/posts/index.html.erb"

const MANIFEST = { file: FILE, identifier: FILE, version: "aaaaaaaa", names: { body: 2, messages: 0 }, parts: {}, states: null }
const MANIFEST_TAG = `<template data-herb-manifests>${JSON.stringify({ [`${FILE}:aaaaaaaa`]: MANIFEST })}</template>`

const ROWS =
  `<!--herb-region:${FILE}:aaaaaaaa:0-->` +
  `<ul><!--herb-slot:0:collection-->` +
  `<!--herb-item:0:a--><li id="a" data-herb-slot="1:attribute:id"><span data-herb-name="body" data-herb-slot="2:child">first</span></li><!--/herb-item:0-->` +
  `<!--herb-item:0:b--><li id="b" data-herb-slot="1:attribute:id"><span data-herb-name="body" data-herb-slot="2:child">second</span></li><!--/herb-item:0-->` +
  `<!--/herb-slot:0--></ul>` +
  `<!--/herb-region:${FILE}-->` + MANIFEST_TAG

const EMPTY =
  `<!--herb-region:${FILE}:aaaaaaaa:0-->` +
  `<ul><!--herb-slot:0:collection--><!--/herb-slot:0--></ul>` +
  `<template data-herb-region="${FILE}:aaaaaaaa"><!--herb-branch:0:item-->` +
  `<!--herb-item:0:--><li id="" data-herb-slot="1:attribute:id"><span data-herb-name="body" data-herb-slot="2:child"></span></li><!--/herb-item:0--></template>` +
  `<!--/herb-region:${FILE}-->` + MANIFEST_TAG

let index: SlotIndex

function watch(): SlotEventDetail[] {
  const seen: SlotEventDetail[] = []

  document.addEventListener(SLOT_EVENT, (event) => seen.push((event as CustomEvent<SlotEventDetail>).detail))

  return seen
}

function keys(): string[] {
  return [...document.querySelectorAll("#a, #b, li")].map((li) => li.id)
}

beforeEach(() => {
  document.body.innerHTML = ROWS

  index = new SlotIndex()
  index.scan(document.body)
})

describe("addItem", () => {
  test("appends at the end of the collection", () => {
    const collection = index.slot(FILE, 0)!
    const item = index.addItem(collection, "c", { values: { body: "third", id: "c" } })

    expect(item).not.toBeNull()
    expect(keys()).toEqual(["a", "b", "c"])
    expect(index.currentText(index.slotInItem(FILE, 0, "c", "body")!)).toBe("third")
  })

  test("inserts before a named sibling", () => {
    const collection = index.slot(FILE, 0)!

    index.addItem(collection, "c", { before: "b", values: { body: "between", id: "c" } })

    expect(keys()).toEqual(["a", "c", "b"])
  })

  test("builds from the parked row into an empty collection", () => {
    document.body.innerHTML = EMPTY
    index = new SlotIndex()
    index.scan(document.body)

    const collection = index.slot(FILE, 0)!
    const item = index.addItem(collection, "x", { values: { body: "hello", id: "x" } })

    expect(item).not.toBeNull()
    expect(index.currentText(index.slotInItem(FILE, 0, "x", "body")!)).toBe("hello")
    expect(document.querySelector("#x")).not.toBeNull()
  })

  test("prefers the parked row over cloning a live row", () => {
    document.querySelector("#a")!.setAttribute("data-decorated", "yes")

    const parked = document.createElement("template")

    parked.setAttribute("data-herb-region", `${FILE}:aaaaaaaa`)
    parked.innerHTML =
      `<!--herb-branch:0:item--><!--herb-item:0:--><li id="" data-herb-slot="1:attribute:id"><span data-herb-name="body" data-herb-slot="2:child"></span></li><!--/herb-item:0-->`
    document.querySelector("ul")!.append(parked)
    index.scan(parked)

    const collection = index.slot(FILE, 0)!

    index.addItem(collection, "c")

    const added = [...document.querySelectorAll("li")].find((li) => li.id === "")

    expect(added?.hasAttribute("data-decorated")).toBe(false)
  })

  test("leaves no stray item branch comment in the built row", () => {
    document.body.innerHTML = EMPTY
    index = new SlotIndex()
    index.scan(document.body)

    index.addItem(index.slot(FILE, 0)!, "x")

    const ul = document.querySelector("ul")!

    expect(ul.innerHTML).not.toContain("herb-branch:0:item")
  })

  test("refuses an existing key and a non-collection slot", () => {
    const collection = index.slot(FILE, 0)!

    expect(index.addItem(collection, "a")).toBeNull()
    expect(index.addItem(index.slotInItem(FILE, 0, "a", "body")!, "x")).toBeNull()
  })

  test("announces item-added", () => {
    const seen = watch()

    index.addItem(index.slot(FILE, 0)!, "c")

    expect(seen.map((event) => event.operation)).toEqual(["item-added", "built"])
    expect(seen[0].key).toBe("c")
    expect(seen[1].cause).toBe("client")
  })
})

describe("rekeyItem", () => {
  test("preserves node identity", () => {
    const collection = index.slot(FILE, 0)!
    const node = document.querySelector("#a")!

    expect(index.rekeyItem(collection, "a", "message_42")).toBe(true)
    expect(index.itemsFor(FILE, 0).get("message_42")!.start.nextSibling).toBe(node)
    expect(index.slotInItem(FILE, 0, "message_42", "body")).not.toBeNull()
    expect(index.itemsFor(FILE, 0).has("a")).toBe(false)
  })

  test("leaves siblings untouched", () => {
    const collection = index.slot(FILE, 0)!
    const sibling = document.querySelector("#b")!

    index.rekeyItem(collection, "a", "z")

    expect(document.querySelector("#b")).toBe(sibling)
    expect(index.itemsFor(FILE, 0).has("b")).toBe(true)
  })

  test("survives a rescan", () => {
    index.rekeyItem(index.slot(FILE, 0)!, "a", "z")
    index.scan(document.body)

    expect(index.itemsFor(FILE, 0).has("z")).toBe(true)
    expect(index.itemsFor(FILE, 0).has("a")).toBe(false)
  })

  test("refuses a taken target and a missing source", () => {
    const collection = index.slot(FILE, 0)!

    expect(index.rekeyItem(collection, "a", "b")).toBe(false)
    expect(index.rekeyItem(collection, "missing", "x")).toBe(false)
    expect(index.rekeyItem(collection, "a", "a")).toBe(false)
  })

  test("announces item-rekeyed with the previous key", () => {
    const seen = watch()

    index.rekeyItem(index.slot(FILE, 0)!, "a", "z")

    expect(seen).toHaveLength(1)
    expect(seen[0].operation).toBe("item-rekeyed")
    expect(seen[0].key).toBe("z")
    expect(seen[0].previousKey).toBe("a")
  })
})

describe("removeItem", () => {
  test("removes the row and reports a missing key", () => {
    const collection = index.slot(FILE, 0)!

    expect(index.removeItem(collection, "a")).toBe(true)
    expect(document.querySelector("#a")).toBeNull()
    expect(index.removeItem(collection, "a")).toBe(false)
  })

  test("parks the last row's shape before deleting it", () => {
    const collection = index.slot(FILE, 0)!

    index.removeItem(collection, "a")
    index.removeItem(collection, "b")

    expect(index.addItem(collection, "again", { values: { body: "back" } })).not.toBeNull()
    expect(index.currentText(index.slotInItem(FILE, 0, "again", "body")!)).toBe("back")
  })
})

describe("a collection nested inside a collection's row", () => {
  const NESTED_FILE = "app/views/posts/nested.html.erb"

  const NESTED =
    `<!--herb-region:${NESTED_FILE}:aaaaaaaa:0--><ul><!--herb-slot:0:collection-->` +
    `<!--herb-item:0:a--><li><span data-herb-slot="1:child">a</span><ol><!--herb-slot:2:collection-->` +
    `<!--herb-item:2:x--><li data-herb-slot="3:child">x</li><!--/herb-item:2-->` +
    `<!--/herb-slot:2--></ol></li><!--/herb-item:0-->` +
    `<!--/herb-slot:0--></ul><!--/herb-region:${NESTED_FILE}-->`

  test("keys the row it builds without touching the rows inside it", () => {
    document.body.innerHTML = NESTED

    const nested = new SlotIndex()
    nested.scan(document.body)

    const collection = nested.slot(NESTED_FILE, 0)!

    nested.addItem(collection, "b")

    const built = collection.items.get("b")!

    expect([...collection.items.keys()]).toEqual(["a", "b"])
    expect(built.slots.get(2)!.type).toBe("collection")
    expect([...built.slots.get(2)!.items.keys()]).toEqual([])
    expect(document.body.innerHTML).not.toContain("herb-item:2:b")
  })
})
