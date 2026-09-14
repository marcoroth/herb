import { describe, test, expect, beforeEach } from "vitest"
import { Slots } from "../src/slots/slots"
import type { Payload } from "../src/types"

const FILE = "app/views/posts/index.html.erb"

const PAGE =
  `<!--herb-region:${FILE}:aaaaaaaa:0-->` +
  `<ul><!--herb-slot:0:collection-->` +
  `<!--herb-item:0:a--><li id="a" data-herb-slot="1:attribute:id"><span data-herb-slot="2:child">first</span></li><!--/herb-item:0-->` +
  `<!--herb-item:0:b--><li id="b" data-herb-slot="1:attribute:id"><span data-herb-slot="2:child">second</span></li><!--/herb-item:0-->` +
  `<!--/herb-slot:0--></ul>` +
  `<!--/herb-region:${FILE}-->`

function payload(items: Record<string, Record<number, string>>): Payload {
  return { template: FILE, version: "aaaaaaaa", occurrence: 0, slots: { 0: { items } } }
}

let index: Slots

function ids(): string[] {
  return [...document.querySelectorAll("li")].map((li) => li.id)
}

beforeEach(() => {
  document.body.innerHTML = PAGE

  index = new Slots()
  index.scan(document.body)
})

describe("apply with merge", () => {
  test("keeps the rows the payload omits", () => {
    const report = index.apply(payload({ c: { 1: "c", 2: "third" } }), { items: "merge" })

    expect(report.deferred).toEqual([])
    expect(ids()).toEqual(["a", "b", "c"])
    expect(index.currentText(index.slotInItem(FILE, 0, "c", 2)!)).toBe("third")
  })

  test("updates a mentioned row in place without moving it", () => {
    const node = document.querySelector("#a")!

    index.apply(payload({ a: { 2: "rewritten" } }), { items: "merge" })

    expect(ids()).toEqual(["a", "b"])
    expect(document.querySelector("#a")).toBe(node)
    expect(index.currentText(index.slotInItem(FILE, 0, "a", 2)!)).toBe("rewritten")
  })

  test("appends several new rows in payload order", () => {
    index.apply(payload({ d: { 1: "d", 2: "four" }, c: { 1: "c", 2: "three" } }), { items: "merge" })

    expect(ids()).toEqual(["a", "b", "d", "c"])
  })

  test("replace still deletes what the payload omits", () => {
    index.apply(payload({ b: { 2: "only" } }), { items: "replace" })

    expect(ids()).toEqual(["b"])
  })

  test("replace is the default", () => {
    index.apply(payload({ b: { 2: "only" } }))

    expect(ids()).toEqual(["b"])
  })

  test("merge inside a nested payload inherits the mode", () => {
    const nested: Payload = {
      template: FILE,
      version: "aaaaaaaa",
      occurrence: 0,
      slots: { 0: { items: { c: { 1: "c", 2: "third" } } } },
    }
    const outer: Payload = { template: FILE, version: "aaaaaaaa", occurrence: 0, slots: { 3: nested } }

    index.apply(outer, { items: "merge" })

    expect(ids()).toEqual(["a", "b", "c"])
  })

  test("defers the adds when nothing can build them", () => {
    document.body.innerHTML =
      `<!--herb-region:${FILE}:aaaaaaaa:0-->` +
      `<ul><!--herb-slot:0:collection--><!--/herb-slot:0--></ul>` +
      `<!--/herb-region:${FILE}-->`
    index = new Slots()
    index.scan(document.body)

    const report = index.apply(payload({ c: { 2: "third" } }), { items: "merge" })

    expect(report.deferred).toEqual([
      { file: FILE, occurrence: 0, index: 0, reason: "items", keys: ["c"] },
    ])
  })

  test("merge after a rekey confirms the row it renamed", () => {
    const collection = index.slot(FILE, 0)!
    const node = document.querySelector("#b")!

    index.rekeyItem(collection, "b", "message_42")

    const report = index.apply(payload({ message_42: { 1: "message_42", 2: "stored" } }), { items: "merge" })

    expect(report.deferred).toEqual([])
    expect(document.querySelector("#message_42")).toBe(node)
    expect(ids()).toEqual(["a", "message_42"])
    expect(index.currentText(index.slotInItem(FILE, 0, "message_42", 2)!)).toBe("stored")
  })
})
