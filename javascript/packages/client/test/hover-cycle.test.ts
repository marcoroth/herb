import { test, expect, afterEach, vi } from "vitest"

import { Runtime } from "../src/runtime"

const FILE = "app/views/test.html.erb"
const PAGE = "<!--herb-region:app/views/test.html.erb:64993c84:0-->\n<span data-herb-set=\"mouseenter->peek='basel'\">basel</span>\n<!--herb-slot:0:conditional--><!--/herb-slot:0-->\n<!--/herb-region:app/views/test.html.erb--><template data-herb-region=\"app/views/test.html.erb:64993c84\"><!--herb-branch:0:0-->\n  <p id=\"card\">\n    <!--herb-slot:1:conditional--><!--/herb-slot:1-->\n  </p>\n<!--herb-branch:1:1--><span class=\"skel\">skeleton</span></template>" + `<template data-herb-dependencies>${JSON.stringify({ state: {}, states: { [FILE]: {"version": "64993c84", "declarations": [{"name": "peek", "kind": "string", "default": "\"\"", "derived": null, "line": 2, "column": 16, "scope": "region", "value": ""}, {"name": "_herb_block_0", "kind": "boolean", "default": "false", "derived": null, "line": null, "column": null, "scope": "region", "value": false, "internal": true}], "reads": {}, "conditionals": {"0": {"arms": [{"branch": 0, "condition": ["peek", null, "present"]}], "else": null}, "1": {"arms": [{"branch": 0, "condition": ["_herb_block_0", null]}], "else": 1}}, "presence": {}, "computed": {}, "server": {"branches": {"0": [{"index": 2, "node_path": [6, 1, 2, 1]}]}, "reads": {"peek": [{"index": 2, "node_path": [6, 1, 2, 1]}]}}, "fragments": {"1": {"mode": "lazy", "state": "_herb_block_0", "fallback": 1, "reads": [2], "delay": 0, "hold": 80}}} } })}</template>`
const PAYLOADS: Record<string, unknown> = {":false": {"template": "app/views/test.html.erb", "version": "64993c84", "occurrence": 0, "slots": {"0": {"branch": null}}}, "basel:false": {"template": "app/views/test.html.erb", "version": "64993c84", "occurrence": 0, "slots": {"0": {"branch": 0, "slots": {"1": {"branch": 1, "slots": {}}}}}}, "basel:true": {"template": "app/views/test.html.erb", "version": "64993c84", "occurrence": 0, "slots": {"0": {"branch": 0, "slots": {"1": {"branch": 0, "statics": "<!--herb-branch:1:0-->\n      <!--herb-slot:2--><!--/herb-slot:2-->\n      \n    ", "slots": {"2": "located basel"}}}}}}, "zurich:true": {"template": "app/views/test.html.erb", "version": "64993c84", "occurrence": 0, "slots": {"0": {"branch": 0, "slots": {"1": {"branch": 0, "statics": "<!--herb-branch:1:0-->\n      <!--herb-slot:2--><!--/herb-slot:2-->\n      \n    ", "slots": {"2": "located zurich"}}}}}}}

let runtime: Runtime | null = null

afterEach(() => {
  runtime?.stop()
  runtime = null
  document.body.innerHTML = ""
})

test("subsequent hovers never repaint the previous text", async () => {
  document.body.innerHTML = PAGE

  const transport = vi.fn(async (state: Record<string, Record<string, unknown>>) => {
    await new Promise((resolve) => setTimeout(resolve, 30))

    const peek = String(state[FILE]?.peek ?? "")
    const block = state[FILE]?._herb_block_0 === true

    return PAYLOADS[`${peek}:${block}`] ?? PAYLOADS[":false"]
  })

  runtime = Runtime.start({ state: { refetchTransport: transport, refetchDebounce: 10 } })
  const live = runtime

  const seen: string[] = []
  const classify = () => {
    const html = document.body.innerHTML
    if (html.includes("located basel")) return "basel"
    if (html.includes("located zurich")) return "zurich"
    if (html.includes("skeleton")) return "skeleton"
    return "empty"
  }
  const observer = new MutationObserver(() => {
    const state = classify()
    if (seen[seen.length - 1] !== state) seen.push(state)
  })
  observer.observe(document.body, { childList: true, subtree: true, characterData: true })

  live.state.setState({ peek: "basel" })

  await vi.waitFor(() => {
    if (!document.body.innerHTML.includes("located basel")) throw new Error("waiting")
  })

  await new Promise((resolve) => setTimeout(resolve, 150))

  live.state.setState({ peek: "" })

  await new Promise((resolve) => setTimeout(resolve, 100))

  const before = seen.length
  live.state.setState({ peek: "zurich" })

  await vi.waitFor(() => {
    if (!document.body.innerHTML.includes("located zurich")) throw new Error("waiting")
  })

  await new Promise((resolve) => setTimeout(resolve, 150))
  observer.disconnect()

  console.log("[dbg] full:", JSON.stringify(seen))
  console.log("[dbg] rehover:", JSON.stringify(seen.slice(before)))

  expect(seen.slice(before)).not.toContain("basel")
})
