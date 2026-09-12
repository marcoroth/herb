import { describe, test, expect, beforeEach } from "vitest"
import { Slots } from "../src/slots/slots"

const FILE = "app/views/chat/show.html.erb"

const MANIFEST = {
  file: FILE,
  identifier: FILE,
  version: "aaaaaaaa",
  names: {},
  parts: { 0: ["", "11"] },
  states: null,
}

const MANIFEST_TAG = `<template data-herb-manifests>${JSON.stringify({ [`${FILE}:aaaaaaaa`]: MANIFEST })}</template>`

const PAGE =
  `<!--herb-region:${FILE}:aaaaaaaa:0-->` +
  `<div><textarea rows="2" data-herb-slot="0:raw_text_interpolation">draft11</textarea></div>` +
  `<!--/herb-region:${FILE}-->` + MANIFEST_TAG

let slots: Slots

function editor(): HTMLTextAreaElement {
  return document.querySelector("textarea")!
}

beforeEach(() => {
  document.body.innerHTML = PAGE

  slots = new Slots()
  slots.scan(document.body)
})

describe("interpolated content slots", () => {
  test("a payload's dynamic parts reconstruct the whole content", () => {
    const report = slots.apply({
      template: FILE,
      version: "aaaaaaaa",
      occurrence: 0,
      slots: { 0: ["typed"] },
    })

    expect(report.deferred).toEqual([])
    expect(editor().textContent).toBe("typed11")
  })

  test("a payload that already matches the content writes nothing", () => {
    const payload = {
      template: FILE,
      version: "aaaaaaaa",
      occurrence: 0,
      slots: { 0: ["typed"] },
    }

    expect(slots.apply(payload).applied).toBe(1)
    expect(slots.apply(payload).applied).toBe(0)
    expect(editor().textContent).toBe("typed11")
  })

  test("a plain text write interpolates around the literal parts", () => {
    const slot = slots.slot(FILE, 0)!

    expect(slots.setText(slot, "hey")).toBe(true)
    expect(editor().textContent).toBe("hey11")
  })

  test("the revert restores the previous whole content", () => {
    const { token } = slots.transaction(() => slots.apply({
      template: FILE,
      version: "aaaaaaaa",
      occurrence: 0,
      slots: { 0: ["typed"] },
    }))

    expect(editor().textContent).toBe("typed11")

    slots.revert(token!)

    expect(editor().textContent).toBe("draft11")
  })
})
