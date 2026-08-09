import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { themes } from "../src/themes.js"

import { Herb } from "@herb-tools/node-wasm"
import { SyntaxRenderer } from "../src/syntax-renderer.js"

import type { StyledRun, StyleRole } from "../src/document.js"

const FIXTURE = "<div class=\"a\">\n  <!-- note -->\n  <% if x %>ok<%= y %>\n</div>"

const roleLabel = (role: StyleRole): string => {
  if (role.kind === "Token") {
    return `Token(${role.tokenType})`
  }

  return role.kind
}

const escapeText = (text: string): string =>
  text.replace(/\\/g, "\\\\").replace(/\n/g, "\\n")

const serialize = (runs: StyledRun[]): string =>
  runs.map((run) => `${roleLabel(run.role)}|${escapeText(run.text)}`).join("\n")

describe("Document", () => {
  let renderer: SyntaxRenderer
  let originalNoColor: string | undefined

  beforeEach(async () => {
    originalNoColor = process.env.NO_COLOR
    delete process.env.NO_COLOR

    renderer = new SyntaxRenderer(themes.onedark, Herb)
    await renderer.initialize()
  })

  afterEach(() => {
    if (originalNoColor === undefined) {
      delete process.env.NO_COLOR
    } else {
      process.env.NO_COLOR = originalNoColor
    }
  })

  it("serializes styled runs for a mixed fixture", () => {
    const runs = renderer.highlightRuns(FIXTURE)

    expect(serialize(runs)).toMatchSnapshot()
  })

  it("lex failure produces a single plain run", async () => {
    const errorHerb = {
      load: async () => {},
      lex: () => ({ errors: ["error"], value: [] }),
      isLoaded: true,
    }

    const errorRenderer = new SyntaxRenderer(themes.onedark, errorHerb as any)
    await errorRenderer.initialize()

    const content = "<invalid>"
    const runs = errorRenderer.highlightRuns(content)

    expect(runs).toEqual([{ text: content, role: { kind: "Plain" } }])
  })

  it("empty content produces no runs", () => {
    const runs = renderer.highlightRuns("")

    expect(runs).toEqual([])
  })
})
