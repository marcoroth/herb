import { test, expect, afterEach, vi } from "vitest"

import { Runtime } from "../src/runtime"

const FILE = "app/views/test.html.erb"
const PAGE = "<!--herb-region:app/views/test.html.erb:6c726602:0-->\n<input value=\"a\" data-herb-slot=\"0:attribute:value\">\n<!--herb-slot:1:conditional--><!--herb-branch:1:0-->\n  <ul>\n    <!--herb-slot:2:collection--><!--herb-item:2:one-->\n      \n      <li data-herb-slot=\"3:child\">ONE</li>\n    <!--/herb-item:2--><!--herb-item:2:two-->\n      \n      <li data-herb-slot=\"3:child\">TWO</li>\n    <!--/herb-item:2--><!--/herb-slot:2-->\n  </ul>\n  \n<!--/herb-slot:1-->\n<!--/herb-region:app/views/test.html.erb--><template data-herb-region=\"app/views/test.html.erb:6c726602\"><!--herb-branch:1:0-->\n  <ul>\n    <!--herb-slot:2:collection--><!--/herb-slot:2-->\n  </ul>\n  \n<!--herb-branch:1:1--><p class=\"skel\">loading</p></template>" + `<template data-herb-dependencies>${JSON.stringify({ state: {}, states: { [FILE]: {"version": "6c726602", "declarations": [{"name": "album", "kind": "string", "default": "\"a\"", "derived": null, "line": 2, "column": 16, "scope": "region", "value": "a"}], "reads": {"album": [0]}, "conditionals": {}, "presence": {}, "computed": {}, "server": {"branches": {}, "reads": {"album": [{"index": 2, "node_path": [6, 1, 1]}]}}, "fragments": {"1": {"fallback": 1, "reads": [2], "delay": 0, "hold": 40}}} } })}</template>`
const PAYLOADS: Record<string, unknown> = {"a": {"template": "app/views/test.html.erb", "version": "6c726602", "occurrence": 0, "slots": {"0": "a", "1": {"branch": 0, "slots": {"2": {"items": {"one": {"3": "ONE"}, "two": {"3": "TWO"}}, "order": ["one", "two"]}}}}}, "b": {"template": "app/views/test.html.erb", "version": "6c726602", "occurrence": 0, "slots": {"0": "b", "1": {"branch": 0, "slots": {"2": {"items": {"alpha": {"3": "ALPHA"}, "beta": {"3": "BETA"}, "gamma": {"3": "GAMMA"}}, "order": ["alpha", "beta", "gamma"]}}}}}}

let runtime: Runtime | null = null

afterEach(() => {
  runtime?.stop()
  runtime = null
  document.body.innerHTML = ""
})

test("switching a fragment-masked collection fills every item with its own values", async () => {
  document.body.innerHTML = PAGE

  const transport = vi.fn(async (state: Record<string, Record<string, unknown>>) => {
    await new Promise((resolve) => setTimeout(resolve, 20))

    return PAYLOADS[String(state[FILE]?.album ?? "a")]
  })

  runtime = Runtime.start({ state: { refetchTransport: transport, refetchDebounce: 10 } })

  expect([...document.querySelectorAll("li")].map((li) => li.textContent!.trim())).toEqual(["ONE", "TWO"])

  runtime.state.setState({ album: "b" })

  await vi.waitFor(() => {
    if (!document.body.innerHTML.includes("GAMMA")) {
      throw new Error("still waiting")
    }
  }, { timeout: 3000 })

  await new Promise((resolve) => setTimeout(resolve, 100))

  const rows = [...document.querySelectorAll("li")].map((li) => li.textContent!.trim())

  expect(rows).toEqual(["ALPHA", "BETA", "GAMMA"])

  runtime.state.setState({ album: "a" })

  await vi.waitFor(() => {
    if (!document.body.innerHTML.includes("TWO")) {
      throw new Error("still waiting")
    }
  }, { timeout: 3000 })

  await new Promise((resolve) => setTimeout(resolve, 100))

  expect([...document.querySelectorAll("li")].map((li) => li.textContent!.trim())).toEqual(["ONE", "TWO"])
})
