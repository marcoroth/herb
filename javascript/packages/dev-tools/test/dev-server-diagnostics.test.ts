import { DEV_SERVER_ORIGIN } from "../src/dev-server/diagnostics"

import { afterEach, beforeEach, describe, expect, test } from "vitest"
import { stripAnsiColors } from "@herb-tools/highlighter"
import { diagnosticsFromError, diagnosticFromBrokenTemplate } from "../src/dev-server/diagnostics"

import { HerbClient } from "../src/dev-server/client"
import { RuntimePanel } from "../src/runtime/panel"

import type { ErrorMessage, WelcomeMessage } from "../src/dev-server/types"

let panels: RuntimePanel[] = []

beforeEach(() => {
  document.body.innerHTML = ""
  sessionStorage.clear()
  panels = []
})

afterEach(() => {
  panels.forEach(panel => panel.destroy())

  document.body.innerHTML = ""
  sessionStorage.clear()
})

function createPanel() {
  const panel = new RuntimePanel()

  panels.push(panel)

  return panel
}

async function waitFor<T>(read: () => T | null, what: string): Promise<T> {
  const deadline = Date.now() + 30000

  while (Date.now() < deadline) {
    const found = read()

    if (found !== null) {
      return found
    }

    await new Promise(resolve => setTimeout(resolve, 25))
  }

  throw new Error(`Timed out waiting for ${what}`)
}

function errorMessage(overrides: Partial<ErrorMessage["errors"][number]> = {}): ErrorMessage {
  return {
    type: "error",
    file: "app/views/posts/index.html.erb",
    errors: [
      {
        name: "missing-closing-tag",
        message: "Opening tag `<form>` has no matching closing tag.",
        line: 2,
        column: 2,
        ...overrides,
      },
    ],
  } as ErrorMessage
}

describe("diagnostics from a dev server error", () => {
  test("counts the column from one, the way the payload does", () => {
    const [diagnostic] = diagnosticsFromError(errorMessage({ column: 2 }))

    expect(diagnostic.location?.start.column).toBe(3)
    expect(diagnostic.location?.start.line).toBe(2)
  })

  test("keeps a column of zero on the page instead of dropping below one", () => {
    const [diagnostic] = diagnosticsFromError(errorMessage({ column: 0 }))

    expect(diagnostic.location?.start.column).toBe(1)
  })

  test("names the file as the template so cards group by it", () => {
    const [diagnostic] = diagnosticsFromError(errorMessage())

    expect(diagnostic.template).toBe("app/views/posts/index.html.erb")
  })

  test("asks for a dismissible screen, since the page on screen still works", () => {
    const [diagnostic] = diagnosticsFromError(errorMessage())

    expect(diagnostic.overlay).toBe("dismissible")
    expect(diagnostic.phase).toBe("compile")
    expect(diagnostic.severity).toBe("error")
  })

  test("names whoever found it, not the road it took here", () => {
    const message = errorMessage()

    message.errors[0].origin = "Herb Parser"
    message.errors[0].code = "missing-closing-tag"
    message.errors[0].suggestion = "Close the `<form>` before the `</div>`."

    const [diagnostic] = diagnosticsFromError(message)

    expect(diagnostic.origin).toBe("Herb Parser")
    expect(diagnostic.code).toBe("missing-closing-tag")
    expect(diagnostic.suggestion).toBe("Close the `<form>` before the `</div>`.")
  })

  test("falls back to the dev server when it did not say who found it", () => {
    const [diagnostic] = diagnosticsFromError(errorMessage())

    expect(diagnostic.origin).toBe(DEV_SERVER_ORIGIN)
    expect(diagnostic.code).toBe("missing-closing-tag")
  })

  test("leaves the suggestion off when there is none", () => {
    const [diagnostic] = diagnosticsFromError(errorMessage())

    expect("suggestion" in diagnostic).toBe(false)
  })

  test("carries the source the server sent, so the panel can draw a frame", () => {
    const message = errorMessage()

    message.source = "<div>\n  <form>\n</div>\n"

    const [diagnostic] = diagnosticsFromError(message)

    expect(diagnostic.source).toBe("<div>\n  <form>\n</div>\n")
  })

  test("leaves the source off when the server sent none", () => {
    const [diagnostic] = diagnosticsFromError(errorMessage())

    expect("source" in diagnostic).toBe(false)
  })

  test("carries every error the message holds", () => {
    const message = errorMessage()

    message.errors.push({ name: "second", message: "another", line: 9, column: 4 })

    expect(diagnosticsFromError(message)).toHaveLength(2)
  })
})

describe("templates the server says were already broken", () => {
  function collectingSink() {
    const reported: Array<[string, number]> = []

    return {
      reported,
      sink: {
        report: (file: string, diagnostics: unknown[]) => {
          reported.push([file, diagnostics.length])
        },
        clear: () => {},
        clearAll: () => {},
      },
    }
  }

  function welcome(broken?: string[]): WelcomeMessage {
    return { type: "welcome", project: "/app", ...(broken === undefined ? {} : { broken_files: broken }) } as WelcomeMessage
  }

  test("reports one diagnostic for every template the welcome names", () => {
    const { reported, sink } = collectingSink()
    const client = new HerbClient({ diagnostics: () => sink })

    client["handleWelcome"](welcome(["a.html.erb", "b.html.erb"]))

    expect(reported).toEqual([["a.html.erb", 1], ["b.html.erb", 1]])
  })

  test("reports nothing when the project has nothing broken", () => {
    const { reported, sink } = collectingSink()
    const client = new HerbClient({ diagnostics: () => sink })

    client["handleWelcome"](welcome([]))

    expect(reported).toEqual([])
  })

  test("reports nothing when the server is old enough not to say", () => {
    const { reported, sink } = collectingSink()
    const client = new HerbClient({ diagnostics: () => sink })

    client["handleWelcome"](welcome())

    expect(reported).toEqual([])
  })

  test("names the dev server as the origin, so a clearing schema takes it away", () => {
    const diagnostic = diagnosticFromBrokenTemplate("a.html.erb")

    expect(diagnostic.origin).toBe(DEV_SERVER_ORIGIN)
    expect(diagnostic.overlay).toBe("dismissible")
    expect(diagnostic.template).toBe("a.html.erb")
  })

  test("opens a card naming the template that did not parse", () => {
    const panel = createPanel()

    panel.report([diagnosticFromBrokenTemplate("app/views/posts/index.html.erb")])

    expect(document.querySelector(".herb-dev-tools-card")?.textContent).toContain("app/views/posts/index.html.erb")

    panel.clear(DEV_SERVER_ORIGIN)

    expect(document.querySelector(".herb-dev-tools-card")).toBeNull()
  })
})

describe("a dev server error in the panel", () => {
  test("opens a dismissible screen and clears again by origin", () => {
    const panel = createPanel()

    panel.report(diagnosticsFromError(errorMessage()))

    expect(document.querySelector(".herb-dev-tools-overlay-focused")).not.toBeNull()
    expect(document.querySelector(".herb-dev-tools-card")?.textContent).toContain("missing-closing-tag")

    panel.clear(DEV_SERVER_ORIGIN)

    expect(document.querySelector(".herb-dev-tools-card")).toBeNull()
  })

  test("is cleared by what was reported, since it no longer answers to the dev server's name", () => {
    const panel = createPanel()
    const message = errorMessage()

    message.errors[0].origin = "Herb Parser"

    const handle = panel.report(diagnosticsFromError(message))

    expect(document.querySelector(".herb-dev-tools-card")).not.toBeNull()

    panel.clear(DEV_SERVER_ORIGIN)

    expect(document.querySelector(".herb-dev-tools-card")).not.toBeNull()

    handle.dismiss()

    expect(document.querySelector(".herb-dev-tools-card")).toBeNull()
  })

  test("renders a highlighted excerpt from the source the server sent", async () => {
    const panel = createPanel()
    const message = errorMessage()

    message.source = "<div>\n  <form>\n</div>\n"

    panel.report(diagnosticsFromError(message))

    const excerpt = await waitFor(
      () => document.querySelector(".herb-dev-tools-excerpt herb-ansi") as HTMLElement | null,
      "the excerpt to hydrate",
    )

    expect(stripAnsiColors(excerpt.textContent ?? "")).toContain("<form>")
  })

  test("shows the dev server connection on a blocking screen, not only in the badge", async () => {
    const panel = createPanel()

    panel.report(diagnosticsFromError(errorMessage()).map(diagnostic => ({ ...diagnostic, overlay: "blocking" as const })))

    const dot = document.querySelector(".herb-dev-tools-connection-dot") as HTMLElement | null
    const status = document.querySelector(".herb-dev-tools-connection-status") as HTMLElement | null

    expect(dot).not.toBeNull()
    expect(status).not.toBeNull()
    expect(status!.textContent).toBe("Dev Server")
  })

  test("leaves it off a dismissible overlay, where the page underneath still works", () => {
    const panel = createPanel()

    panel.report(diagnosticsFromError(errorMessage()))

    expect(document.querySelector(".herb-dev-tools-connection-dot")).toBeNull()
  })

  test("keeps that indicator through a re-render, since the panel rewrites its own header", () => {
    const panel = createPanel()

    panel.report(diagnosticsFromError(errorMessage()).map(diagnostic => ({ ...diagnostic, overlay: "blocking" as const })))
    panel.report(diagnosticsFromError(errorMessage({ line: 9 })).map(diagnostic => ({ ...diagnostic, overlay: "blocking" as const })))

    expect(document.querySelectorAll(".herb-dev-tools-connection-dot")).toHaveLength(1)
  })

  test("a schema with no diagnostics clears exactly the file it names", () => {
    const files: Array<[string, number]> = []
    const sink = {
      report: (file: string, diagnostics: unknown[]) => {
        files.push([file, diagnostics.length])
      },
      clear: () => {},
      clearAll: () => {},
    }

    const client = new HerbClient({ diagnostics: () => sink })

    client["handleSchema"]({
      type: "schema",
      file: "app/views/posts/index.html.erb",
      mode: "client",
      version: { from: "a", to: "b" },
      manifest: null,
      static_markup: null,
      statics: null,
      remap: null,
      diagnostics: [],
      source: null,
    })

    expect(files).toEqual([["app/views/posts/index.html.erb", 0]])
  })

  test("renders no excerpt when the server sent no source", () => {
    const panel = createPanel()

    panel.report(diagnosticsFromError(errorMessage()))

    expect(document.querySelector(".herb-dev-tools-excerpt")).toBeNull()
  })
})
