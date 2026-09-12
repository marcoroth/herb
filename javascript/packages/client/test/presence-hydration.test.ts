import { describe, test, expect, beforeEach } from "vitest"

import { Slots } from "../src/slots/slots"
import { State } from "../src/state/state"

const FILE = "app/views/page/panel.html.erb"

const PAGE =
  `<!--herb-region:${FILE}:dddddddd:0-->` +
  `<p data-herb-slot="1:boolean_attribute:hidden">secret</p>` +
  `<input type="checkbox" data-herb-slot="2:boolean_attribute:checked" checked>` +
  `<b data-herb-slot="3:boolean_attribute:hidden" hidden>note</b>` +
  `<button data-herb-slot="4:attribute:aria-selected" aria-selected="true">Profile</button>` +
  `<!--/herb-region:${FILE}-->`

const MANIFEST = {
  state: {},
  states: {
    [FILE]: {
      version: "dddddddd",
      declarations: [
        { name: "open", kind: "boolean", default: "false", scope: "region" },
        { name: "news", kind: "boolean", default: "false", scope: "region" },
        { name: "note", kind: "string", default: '""', scope: "region" },
        { name: "tab", kind: "string", default: '"profile"', scope: "region" },
      ],
      reads: { open: [1], news: [2], note: [3], tab: [4] },
      conditionals: {},
      presence: { 1: ["open", null, "falsy"], 2: ["news", null], 3: ["note", null, "blank"] },
      computed: { 4: ["tab", { value: "profile" }] },
    },
  },
}

let state: State

beforeEach(() => {
  document.body.innerHTML = PAGE + `<template data-herb-dependencies>${JSON.stringify(MANIFEST)}</template>`

  const slots = new Slots()

  slots.scan(document.body)

  state = new State(slots, {
    transport: () => {
      throw new Error("a declared state must never reach the transport")
    },
  })

  state.adopt()
})

describe("hydrating a state from a presence attribute", () => {
  test("a negated presence reads inverted, so a missing `hidden` means true", () => {
    expect(state.getState("open")).toBe(true)
  })

  test("a bare presence reads straight", () => {
    expect(state.getState("news")).toBe(true)
  })

  test("a non-boolean behind an operator falls back to its default", () => {
    expect(state.getState("note")).toBe("")
  })

  test("a comparison read never hydrates, so a rendered `true` is not a value", () => {
    expect(state.getState("tab")).toBe("profile")
  })
})
