import { test, expect, afterEach, vi } from "vitest"

import { Runtime } from "../src/runtime"

const FILE = "app/views/test.html.erb"

const PAGE =
  `<!--herb-region:${FILE}:11aa22bb:0-->` +
  `<!--herb-slot:0:conditional--><!--herb-branch:0:0--><p id="loaded">tracks <!--herb-slot:2-->one two<!--/herb-slot:2--></p><!--/herb-slot:0-->` +
  `<!--/herb-region:${FILE}-->` +
  `<template data-herb-region="${FILE}:11aa22bb"><!--herb-branch:0:0--><p id="loaded">tracks <!--herb-slot:2--><!--/herb-slot:2--></p><!--herb-branch:0:1--><p id="waiting">by <!--herb-slot:1--><!--/herb-slot:1--></p></template>` +
  `<template data-herb-dependencies>${JSON.stringify({
    state: {},
    states: {
      [FILE]: {
        version: "11aa22bb",
        declarations: [
          { name: "album", kind: "string", default: '""', scope: "region", value: "a" },
          { name: "artist", kind: "string", default: '""', scope: "region", value: "" },
        ],
        reads: { artist: [1] },
        conditionals: { 0: { arms: [{ branch: 0, condition: ["album", null, "present"] }], else: 1 } },
        server: { branches: { 0: [{ index: 2, node_path: [0] }] }, reads: { album: [{ index: 2, node_path: [0] }] } },
        fragments: { 0: { fallback: 1, reads: [2], on: ["album"], delay: 0, hold: 50 } },
      },
    },
  })}</template>`

let runtime: Runtime | null = null

afterEach(() => {
  runtime?.stop()
  runtime = null
  document.body.innerHTML = ""
})

test("a presented fallback seeds the state reads it contains", async () => {
  document.body.innerHTML = PAGE

  const transport = vi.fn(() => new Promise<never>(() => {}))

  runtime = Runtime.start({ state: { refetchTransport: transport as never, refetchDebounce: 0 } })

  runtime.state.setState({ artist: "Modular Grid" })
  runtime.state.setState({ album: "b" })

  await vi.waitFor(() => {
    if (!document.getElementById("waiting")) {
      throw new Error("fallback not presented yet")
    }
  })

  expect(document.getElementById("waiting")!.textContent).toBe("by Modular Grid")
})
