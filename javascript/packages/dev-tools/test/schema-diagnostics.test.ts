import { afterEach, beforeEach, expect, test } from "vitest"

import { HerbDevTools } from "../src/herb-dev-tools"
import { HerbClient } from "../src/dev-server/client"

import type { SchemaMessage } from "../src/dev-server/types"

beforeEach(() => {
  document.body.innerHTML = ""
  sessionStorage.clear()
})

afterEach(() => {
  document.body.innerHTML = ""
  sessionStorage.clear()
})

const WIRE_DIAGNOSTIC = {
  template: "app/views/chat/show.html.erb",
  message: "`draft.reverse.upcase` computes with a state. The client cannot evaluate Ruby.",
  code: "slots-read",
  severity: "error",
  kind: "diagnostic",
  origin: "Herb Compiler",
  location: { start: { line: 3, column: 4 }, end: { line: 3, column: 31 } },
  phase: "compile",
}

function schema(diagnostics: unknown[]): SchemaMessage {
  return {
    type: "schema",
    file: "app/views/chat/show.html.erb",
    mode: "client",
    version: { from: "a", to: "b" },
    manifest: null,
    static_markup: null,
    statics: null,
    remap: null,
    diagnostics: diagnostics as SchemaMessage["diagnostics"],
    source: "<p><%= draft.reverse.upcase %></p>",
  }
}

test("a schema push sweeps stale page-injected cards for its template but spares live sources", () => {
  const devTools = HerbDevTools.start({ devServer: false, overlay: false })

  expect(devTools).not.toBeNull()

  try {
    devTools!.report([
      { ...WIRE_DIAGNOSTIC, message: "stale finding from the page load" } as never,
      {
        template: "app/views/chat/show.html.erb",
        message: "browser lint finding that must survive",
        severity: "warning",
        origin: "Herb Linter (Rendered Page)",
      } as never,
      { ...WIRE_DIAGNOSTIC, template: "app/views/other.html.erb", message: "other file, untouched" } as never,
    ])

    const sink = (devTools as unknown as { diagnosticSink(): { report(file: string, d: unknown[]): void } }).diagnosticSink()
    const client = new HerbClient({ diagnostics: () => sink as never })

    client["handleSchema"](schema([]))

    expect(document.body.textContent).not.toContain("stale finding from the page load")
    expect(document.body.textContent).toContain("browser lint finding that must survive")
    expect(document.body.textContent).toContain("other file, untouched")
  } finally {
    devTools?.stop()
  }
})

test("a pushed slots-read diagnostic reaches the panel and clears on the next clean schema", () => {
  const devTools = HerbDevTools.start({ devServer: false, overlay: false })

  expect(devTools).not.toBeNull()

  try {
    const sink = (devTools as unknown as { diagnosticSink(): { report(file: string, d: unknown[]): void } }).diagnosticSink()
    const client = new HerbClient({ diagnostics: () => sink as never })

    client["handleSchema"](schema([WIRE_DIAGNOSTIC]))

    expect(document.body.textContent).toContain("slots-read")
    expect(document.body.textContent).toContain("computes with a state")

    client["handleSchema"](schema([]))

    expect(document.body.textContent).not.toContain("slots-read")
  } finally {
    devTools?.stop()
  }
})
