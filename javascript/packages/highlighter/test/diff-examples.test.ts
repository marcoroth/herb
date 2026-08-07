import { describe, it, expect, beforeAll } from "vitest"

import { Herb } from "@herb-tools/node-wasm"

import { Highlighter } from "../src/highlighter.js"
import { renderDiffExamples } from "../examples/diff-view.js"
import { stripAnsiColors } from "./util.js"

describe("examples/diff-view.ts", () => {
  let highlighter: Highlighter

  beforeAll(async () => {
    await Herb.load()

    highlighter = new Highlighter("onedark", Herb)

    await highlighter.initialize()
  })

  it("renders every example", () => {
    expect(stripAnsiColors(renderDiffExamples(highlighter))).toMatchSnapshot()
  })
})
