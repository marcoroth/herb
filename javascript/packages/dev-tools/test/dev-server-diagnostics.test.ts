import { DEV_SERVER_ORIGIN } from "../src/dev-server/diagnostics"

import { afterEach, beforeEach, describe, expect, test } from "vitest"
import { stripAnsiColors } from "@herb-tools/highlighter"
import { diagnosticsFromError } from "../src/dev-server/diagnostics"

import { RuntimePanel } from "../src/runtime/panel"

import type { ErrorMessage } from "../src/dev-server/types"

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

  test("carries an origin the client can clear on its own", () => {
    const [diagnostic] = diagnosticsFromError(errorMessage())

    expect(diagnostic.origin).toBe(DEV_SERVER_ORIGIN)
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

describe("a dev server error in the panel", () => {
  test("opens a dismissible screen and clears again by origin", () => {
    const panel = createPanel()

    panel.report(diagnosticsFromError(errorMessage()))

    expect(document.querySelector(".herb-dev-tools-overlay-focused")).not.toBeNull()
    expect(document.querySelector(".herb-dev-tools-card")?.textContent).toContain("missing-closing-tag")

    panel.clear(DEV_SERVER_ORIGIN)

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

  test("renders no excerpt when the server sent no source", () => {
    const panel = createPanel()

    panel.report(diagnosticsFromError(errorMessage()))

    expect(document.querySelector(".herb-dev-tools-excerpt")).toBeNull()
  })
})
