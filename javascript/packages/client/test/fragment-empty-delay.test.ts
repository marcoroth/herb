import { test, expect, afterEach, vi } from "vitest"

import { Runtime } from "../src/runtime"

const FILE = "app/views/test.html.erb"

const PAGE =
  `<!--herb-region:${FILE}:11aa22bb:0-->` +
  `<input value="" data-herb-slot="0:attribute:value">` +
  `<!--herb-slot:1:conditional--><!--/herb-slot:1-->` +
  `<!--/herb-region:${FILE}-->` +
  `<template data-herb-region="${FILE}:11aa22bb"><!--herb-branch:1:0--><p id="loaded"><!--herb-slot:2--><!--/herb-slot:2--></p><!--herb-branch:1:1--><p id="waiting">loading</p></template>` +
  `<template data-herb-dependencies>${JSON.stringify({
    state: {},
    states: {
      [FILE]: {
        version: "11aa22bb",
        declarations: [{ name: "album", kind: "string", default: '""', scope: "region", value: "" }],
        reads: { album: [0] },
        conditionals: { 1: { arms: [{ branch: 0, condition: ["album", null, "present"] }], else: 1 } },
        server: { branches: { 1: [{ index: 2, node_path: [0] }] }, reads: { album: [{ index: 2, node_path: [0] }] } },
        fragments: { 1: { fallback: 1, reads: [2], on: ["album"], delay: 400, hold: 40 } },
      },
    },
  })}</template>`

let runtime: Runtime | null = null

afterEach(() => {
  runtime?.stop()
  runtime = null
  document.body.innerHTML = ""
})

test("an empty fragment shows its fallback immediately even with a delay", async () => {
  document.body.innerHTML = PAGE

  const transport = vi.fn(() => new Promise<never>(() => {}))

  runtime = Runtime.start({ state: { refetchTransport: transport as never, refetchDebounce: 0 } })

  runtime.state.setState({ album: "b" })

  await vi.waitFor(() => {
    if (!document.getElementById("waiting")) {
      throw new Error("fallback not shown yet")
    }
  }, { timeout: 200 })

  expect(document.getElementById("waiting")!.textContent).toBe("loading")
})
