import { describe, test, expect, beforeEach, afterEach } from "vitest"
import { SlotIndex } from "../src/slot-index"
import { SlotState } from "../src/state"

const FILE = "app/views/chat/show.html.erb"

const PAGE =
  `<!--herb-region:${FILE}:aaaaaaaa:0-->` +
  `<input value="" data-herb-slot="0:attribute:value">` +
  `<button disabled data-herb-slot="1:boolean_attribute:disabled">Send</button>` +
  `<video data-herb-slot="2:boolean_attribute:muted"></video>` +
  `<!--/herb-region:${FILE}-->` +
  `<template data-herb-dependencies>${JSON.stringify({
    state: {},
    states: {
      [FILE]: {
        version: "aaaaaaaa",
        declarations: [
          { name: "draft", kind: "string", default: '""', scope: "region" },
          { name: "sending", kind: "boolean", default: "false", scope: "region" },
        ],
        reads: { draft: [0, 1], sending: [2] },
        bound: { draft: [0] },
        conditionals: {},
        presence: { 1: ["draft", '""'], 2: ["sending", null] },
      },
    },
  })}</template>`

let slots: SlotIndex
let state: SlotState

function button(): HTMLButtonElement {
  return document.querySelector("button")!
}

function video(): HTMLVideoElement {
  return document.querySelector("video")!
}

beforeEach(() => {
  document.body.innerHTML = PAGE

  slots = new SlotIndex()
  slots.scan(document.body)

  state = new SlotState(slots, { persist: "none" })
  state.adopt()
  state.observe()
})

afterEach(() => state.disconnect())

describe("a skeleton derived from a live row", () => {
  test("is born without the row's boolean attributes", () => {
    document.body.innerHTML =
      `<!--herb-region:${FILE}:aaaaaaaa:0-->` +
      `<ul><!--herb-slot:9:collection-->` +
      `<!--herb-item:9:a--><li id="a" data-herb-slot="10:attribute:id"><input type="checkbox" checked data-herb-slot="11:boolean_attribute:checked"></li><!--/herb-item:9-->` +
      `<!--/herb-slot:9--></ul>` +
      `<!--/herb-region:${FILE}-->`

    const index = new SlotIndex()

    index.scan(document.body)

    const collection = index.slot(FILE, 9)!
    const item = index.addItem(collection, "b", { values: { 10: "b" } })

    expect(item).not.toBeNull()

    const fresh = document.querySelectorAll("li")[1].querySelector("input")!

    expect(fresh.hasAttribute("checked")).toBe(false)
  })
})

describe("state-driven boolean attributes", () => {
  test("an equality presence follows the state it compares", () => {
    expect(button().disabled).toBe(true)

    state.setState({ draft: "hello" })

    expect(button().hasAttribute("disabled")).toBe(false)
    expect(button().disabled).toBe(false)

    state.setState({ draft: "" })

    expect(button().hasAttribute("disabled")).toBe(true)
    expect(button().disabled).toBe(true)
  })

  test("a bare presence follows the boolean it reads", () => {
    expect(video().hasAttribute("muted")).toBe(false)

    state.setState({ sending: true })

    expect(video().hasAttribute("muted")).toBe(true)
    expect(video().muted).toBe(true)

    state.setState({ sending: false })

    expect(video().hasAttribute("muted")).toBe(false)
  })

  test("typing into the bound input drives the presence", () => {
    const input = document.querySelector<HTMLInputElement>("input")!

    input.value = "typed"
    input.dispatchEvent(new Event("input", { bubbles: true }))

    expect(button().disabled).toBe(false)
  })

  test("the presence is toggled, never written as text", () => {
    state.setState({ draft: "hello" })
    state.setState({ draft: "" })

    expect(button().getAttribute("disabled")).toBe("")
  })

  test("a bare presence seeds from what the page rendered", () => {
    document.body.innerHTML = PAGE.replace("<video ", "<video muted ")

    const freshSlots = new SlotIndex()
    freshSlots.scan(document.body)

    const fresh = new SlotState(freshSlots, { persist: "none" })
    fresh.adopt()

    expect(fresh.getState("sending")).toBe(true)
  })

  test("a payload boolean applies as presence and reverts as one", () => {
    const report = slots.apply({
      template: FILE,
      version: "aaaaaaaa",
      occurrence: 0,
      slots: { 2: true },
    })

    expect(report.applied).toBe(1)
    expect(video().hasAttribute("muted")).toBe(true)

    if (report.token) slots.revert(report.token)

    expect(video().hasAttribute("muted")).toBe(false)
  })
})
