import { describe, test, expect, beforeEach } from "vitest"
import { SlotIndex } from "../src/slot-index"
import type { Payload } from "../src/slot-index"

const FILE = "app/views/posts/index.html.erb"

const PAGE =
  `<!--herb-region:${FILE}:aaaaaaaa:0-->` +
  `<p><!--herb-slot:3--><b>bold</b> text<!--/herb-slot:3--></p>` +
  `<ul><!--herb-slot:0:collection-->` +
  `<!--herb-item:0:a--><li id="a" data-herb-slot="1:attribute:id"><span data-herb-slot="2:child">first</span></li><!--/herb-item:0-->` +
  `<!--herb-item:0:b--><li id="b" data-herb-slot="1:attribute:id"><span data-herb-slot="2:child">second</span></li><!--/herb-item:0-->` +
  `<!--/herb-slot:0--></ul>` +
  `<div><!--herb-slot:4:conditional--><!--herb-branch:4:1--><i>shown</i><!--/herb-slot:4--></div>` +
  `<section data-herb-slot="5:element">original</section>` +
  `<div id="cond"><!--herb-slot:6:conditional--><!--herb-branch:6:1--><p data-herb-slot="7:child">typed</p><!--/herb-slot:6--></div>` +
  `<template data-herb-statics="6:0"><!--herb-branch:6:0--><em>off</em></template>` +
  `<template data-herb-statics="4:0"><!--herb-branch:4:0--><em>hidden</em></template>` +
  `<!--/herb-region:${FILE}-->`

let index: SlotIndex

function ids(): string[] {
  return [...document.querySelectorAll("li")].map((li) => li.id)
}

beforeEach(() => {
  document.body.innerHTML = PAGE

  index = new SlotIndex()
  index.scan(document.body)
})

describe("transaction and revert", () => {
  test("reverts an applied branch switch to the previous markup", () => {
    const report = index.apply({ template: FILE, version: "aaaaaaaa", occurrence: 0, slots: { 4: { branch: 0 } } })

    expect(document.querySelector("div em")?.textContent).toBe("hidden")

    index.revert(report.token!)

    expect(document.querySelector("div i")?.textContent).toBe("shown")
    expect(index.slot(FILE, 4)!.branch).toBe(1)
  })

  test("reverting a branch switch restores the branch's dynamic values", () => {
    const slot = index.slot(FILE, 6)!

    const { token } = index.transaction(() => index.switchBranch(slot, 0))

    expect(document.querySelector("#cond em")?.textContent).toBe("off")

    index.revert(token!)

    expect(document.querySelector("#cond p")?.textContent).toBe("typed")
  })

  test("reverts an element slot update through the rescanned parent", () => {
    const slot = index.slot(FILE, 5)!

    const { token } = index.transaction(() =>
      index.update(slot, `<section data-herb-slot="5:element">changed</section>`),
    )

    expect(document.querySelector("section")?.textContent).toBe("changed")

    index.revert(token!)

    expect(document.querySelector("section")?.textContent).toBe("original")
  })

  test("restores markup rather than flattening it", () => {
    const slot = index.slot(FILE, 3)!

    const { token } = index.transaction(() => index.setText(slot, "plain"))

    expect(document.querySelector("p b")).toBeNull()
    expect(index.revert(token!)).toBe(true)
    expect(document.querySelector("p b")?.textContent).toBe("bold")
  })

  test("reverts an addItem by removing the row", () => {
    const collection = index.slot(FILE, 0)!

    const { token } = index.transaction(() => index.addItem(collection, "c", { values: { 2: "third", 1: "c" } }))

    expect(ids()).toEqual(["a", "b", "c"])
    index.revert(token!)
    expect(ids()).toEqual(["a", "b"])
    expect(index.itemsFor(FILE, 0).has("c")).toBe(false)
  })

  test("reverts a removeItem by rebuilding the row with its values", () => {
    const collection = index.slot(FILE, 0)!

    const { token } = index.transaction(() => index.removeItem(collection, "a"))

    expect(ids()).toEqual(["b"])
    index.revert(token!)
    expect(ids()).toEqual(["a", "b"])
    expect(index.currentText(index.slotInItem(FILE, 0, "a", 2)!)).toBe("first")
  })

  test("reverts a rekey back to the old key on the same node", () => {
    const collection = index.slot(FILE, 0)!
    const node = document.querySelector("#a")!

    const { token } = index.transaction(() => index.rekeyItem(collection, "a", "z"))

    index.revert(token!)

    expect(index.itemsFor(FILE, 0).has("a")).toBe(true)
    expect(index.itemsFor(FILE, 0).has("z")).toBe(false)
    expect(document.querySelector("#a")).toBe(node)
  })

  test("reverts a branch switch", () => {
    const slot = index.slot(FILE, 4)!

    const { token } = index.transaction(() => index.switchBranch(slot, 0))

    expect(document.querySelector("em")).not.toBeNull()
    index.revert(token!)
    expect(index.slot(FILE, 4)?.branch).toBe(1)
    expect(document.querySelector("i")?.textContent).toBe("shown")
  })

  test("reverts an attribute write, including one that was absent", () => {
    const slot = index.slotInItem(FILE, 0, "a", 1)!

    const { token } = index.transaction(() => {
      index.setAttribute(slot, "renamed")
      index.setAttribute(slot, "on", "data-flag")
    })

    index.revert(token!)

    const li = document.querySelector("li")!

    expect(li.id).toBe("a")
    expect(li.hasAttribute("data-flag")).toBe(false)
  })

  test("a transaction reverts as a unit, in reverse order", () => {
    const collection = index.slot(FILE, 0)!
    const text = index.slot(FILE, 3)!

    const { token } = index.transaction(() => {
      index.setText(text, "changed")
      index.addItem(collection, "c", { values: { 1: "c" } })
      index.rekeyItem(collection, "c", "d")
    })

    index.revert(token!)

    expect(document.querySelector("p b")?.textContent).toBe("bold")
    expect(ids()).toEqual(["a", "b"])
  })

  test("a nested transaction merges into the outer one", () => {
    const text = index.slot(FILE, 3)!

    const { token } = index.transaction(() => {
      const inner = index.transaction(() => index.setText(text, "inner"))

      expect(inner.token).toBeNull()
    })

    index.revert(token!)

    expect(document.querySelector("p b")?.textContent).toBe("bold")
  })

  test("apply carries a token that reverts the whole payload", () => {
    const payload: Payload = {
      template: FILE,
      version: "aaaaaaaa",
      occurrence: 0,
      slots: { 3: "replaced", 0: { items: { a: { 2: "rewritten" } } } },
    }

    const report = index.apply(payload, { items: "merge" })

    expect(report.token).toBeDefined()
    expect(index.revert(report.token!)).toBe(true)
    expect(document.querySelector("p b")?.textContent).toBe("bold")
    expect(index.currentText(index.slotInItem(FILE, 0, "a", 2)!)).toBe("first")
  })

  test("an unchanged transaction yields no token, and a token reverts once", () => {
    const text = index.slot(FILE, 3)!
    const empty = index.transaction(() => index.setText(text, index.currentText(text)))

    expect(empty.token).toBeNull()

    const { token } = index.transaction(() => index.setText(text, "changed"))

    expect(index.revert(token!)).toBe(true)
    expect(index.revert(token!)).toBe(false)
    expect(index.revert(999)).toBe(false)
  })

  test("nothing is journalled outside a transaction", () => {
    const text = index.slot(FILE, 3)!

    index.setText(text, "changed")

    const { token } = index.transaction(() => index.setText(text, "again"))

    index.revert(token!)

    expect(index.currentText(text)).toBe("changed")
  })
})
