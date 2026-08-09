import { beforeAll, describe, expect, test, vi } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { TextDocument } from "vscode-languageserver-textdocument"

import { Settings } from "../src/settings"
import { Diagnostics } from "../src/diagnostics"
import { ParserService } from "../src/parser_service"

import type { Connection, InitializeParams, PublishDiagnosticsParams } from "vscode-languageserver/node"
import type { ConfigService } from "../src/config_service"
import type { LinterService } from "../src/linter_service"
import type { DocumentService } from "../src/document_service"

const WORKSPACE = "file:///work/foo"
const INSIDE = `${WORKSPACE}/app/views/broken.html.erb`
const OUTSIDE = "file:///work/bar/example.html"

const BROKEN = `<div><span></div>\n`

describe("Diagnostics", () => {
  let parserService: ParserService

  beforeAll(async () => {
    await Herb.load()

    parserService = new ParserService()
  })

  function diagnosticsFor(folders: string[] | null) {
    const published: PublishDiagnosticsParams[] = []

    const connection = {
      console: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
      sendDiagnostics: (params: PublishDiagnosticsParams) => published.push(params),
    } as unknown as Connection

    const params = {
      processId: null,
      rootUri: null,
      capabilities: {},
      workspaceFolders: folders?.map(uri => ({ uri, name: uri })) ?? null,
    } as InitializeParams

    const documentService = { getAll: () => [] } as unknown as DocumentService
    const linterService = { lintDocument: async () => ({ diagnostics: [] }) } as unknown as LinterService
    const configService = { validateDocument: async () => [] } as unknown as ConfigService

    const diagnostics = new Diagnostics(
      connection,
      documentService,
      parserService,
      linterService,
      configService,
      new Settings(params, connection),
    )

    return { diagnostics, published }
  }

  function documentFor(uri: string): TextDocument {
    return TextDocument.create(uri, "erb", 1, BROKEN)
  }

  test("publishes diagnostics for a document inside the workspace", async () => {
    const { diagnostics, published } = diagnosticsFor([WORKSPACE])

    await diagnostics.validate(documentFor(INSIDE))

    expect(published).toHaveLength(1)
    expect(published[0].uri).toBe(INSIDE)
    expect(published[0].diagnostics.length).toBeGreaterThan(0)
  })

  test("publishes nothing but a retraction for a document outside the workspace", async () => {
    const { diagnostics, published } = diagnosticsFor([WORKSPACE])

    await diagnostics.validate(documentFor(OUTSIDE))

    expect(published).toEqual([{ uri: OUTSIDE, diagnostics: [] }])
  })

  test("still reports when the client opened no folder", async () => {
    const { diagnostics, published } = diagnosticsFor(null)

    await diagnostics.validate(documentFor(OUTSIDE))

    expect(published[0].diagnostics.length).toBeGreaterThan(0)
  })

  test("clear retracts the diagnostics of a document", () => {
    const { diagnostics, published } = diagnosticsFor([WORKSPACE])

    diagnostics.clear(INSIDE)

    expect(published).toEqual([{ uri: INSIDE, diagnostics: [] }])
  })

  test("clear retracts a document that was reported on earlier", async () => {
    const { diagnostics, published } = diagnosticsFor([WORKSPACE])

    await diagnostics.validate(documentFor(INSIDE))
    diagnostics.clear(INSIDE)

    expect(published).toHaveLength(2)
    expect(published[1]).toEqual({ uri: INSIDE, diagnostics: [] })
  })
})
