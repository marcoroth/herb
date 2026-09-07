import { describe, test, expect } from "vitest"

import { Slots } from "../src/slots/slots"
import type { Payload } from "../src/types"

const FILE = "app/views/music/show.html.erb"

const KEYED =
  `<!--herb-region:${FILE}:aaaaaaaa:0--><div>` +
  `<!--herb-slot:0:keyed:warehouse:1--><b class="playhead" data-herb-slot="1:child">seven</b><!--/herb-slot:0-->` +
  `</div><!--/herb-region:${FILE}-->`

const PARKED = `<template data-herb-region="${FILE}:aaaaaaaa"><!--herb-branch:0:item--><b class="playhead" data-herb-slot="1:child"></b></template>`

function mounted(html: string): Slots {
  document.body.innerHTML = html

  const index = new Slots()
  index.scan(document.body)

  return index
}

function payload(slots: Payload["slots"]): Payload {
  return { template: FILE, version: "aaaaaaaa", occurrence: 0, slots }
}

describe("a keyed slot", () => {
  test("scans with its key read from the marker", () => {
    const slots = mounted(KEYED)
    const slot = slots.slot(FILE, 0)!

    expect(slot.type).toBe("keyed")
    expect(slot.key).toBe("warehouse:1")
  })

  test("holds its subtree as a keyed item so item scoping works", () => {
    const slots = mounted(KEYED)
    const slot = slots.slot(FILE, 0)!
    const held = slot.items.get("warehouse:1")!

    expect(held.collection).toBe(slot)
    expect(held.slots.has(1)).toBe(true)
  })

  test("the item follows the key across a rebuild", () => {
    const slots = mounted(KEYED + PARKED)

    slots.apply(payload({ 0: { key: "warehouse:2", slots: { 1: "eight" } } }))

    const slot = slots.slot(FILE, 0)!
    const held = slot.items.get("warehouse:2")!

    expect(slot.items.size).toBe(1)
    expect(held.slots.has(1)).toBe(true)
  })

  test("fills inner slots in place while the key holds", () => {
    const slots = mounted(KEYED + PARKED)
    const before = document.querySelector(".playhead")

    const report = slots.apply(payload({ 0: { key: "warehouse:1", slots: { 1: "still seven" } } }))

    expect(report.applied).toBe(1)
    expect(document.querySelector(".playhead")).toBe(before)
    expect(document.body.textContent).toContain("still seven")
  })

  test("rebuilds the subtree from parked statics when the key changes", () => {
    const slots = mounted(KEYED + PARKED)
    const before = document.querySelector(".playhead")

    slots.apply(payload({ 0: { key: "warehouse:2", slots: { 1: "eight" } } }))

    const after = document.querySelector(".playhead")
    const slot = slots.slot(FILE, 0)!

    expect(after).not.toBe(before)
    expect(document.body.textContent).toContain("eight")
    expect(slot.key).toBe("warehouse:2")
    expect(slot.anchor.kind === "range" && slot.anchor.start.data).toBe("herb-slot:0:keyed:warehouse:2")
    expect(document.querySelector("div")!.innerHTML).not.toContain("herb-branch:0:item")
  })

  test("rebuilds by blanking the live subtree when nothing is parked", () => {
    const slots = mounted(KEYED)
    const before = document.querySelector(".playhead")

    slots.apply(payload({ 0: { key: "warehouse:3", slots: { 1: "nine" } } }))

    const after = document.querySelector(".playhead")

    expect(after).not.toBe(before)
    expect(after?.className).toBe("playhead")
    expect(document.body.textContent).toContain("nine")
  })

  test("a rebuilt subtree keeps answering later payloads", () => {
    const slots = mounted(KEYED + PARKED)

    slots.apply(payload({ 0: { key: "warehouse:2", slots: { 1: "eight" } } }))
    slots.apply(payload({ 0: { key: "warehouse:2", slots: { 1: "eight point five" } } }))

    expect(document.body.textContent).toContain("eight point five")
  })
})
