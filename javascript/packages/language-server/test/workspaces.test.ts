import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, dirname } from "node:path"
import { pathToFileURL } from "node:url"

import { beforeAll, afterEach, describe, expect, test, vi } from "vitest"

import { Herb } from "@herb-tools/node-wasm"

import { Workspaces } from "../src/workspaces"
import { Settings } from "../src/settings"
import { ParserService } from "../src/parser_service"
import { DefinitionService } from "../src/definition_service"

import type { Connection, InitializeParams } from "vscode-languageserver/node"
import type { DocumentService } from "../src/document_service"

const roots: string[] = []

const connection = {
  console: { log: vi.fn(), warn: vi.fn(), error: vi.fn() }
} as unknown as Connection

const OUTER_CONFIG = `linter:\n  enabled: true\n  rules:\n    html-tag-name-lowercase:\n      enabled: false\n`
const NESTED_CONFIG = `linter:\n  enabled: true\n  rules:\n    html-tag-name-lowercase:\n      enabled: true\n`

const FILES = {
  ".herb.yml": OUTER_CONFIG,
  "app/views/posts/_outer.html.erb": `<article></article>\n`,
  "app/views/posts/index.html.erb": `<div></div>\n`,
  "nested/.herb.yml": NESTED_CONFIG,
  "nested/app/views/posts/_inner.html.erb": `<section></section>\n`,
  "nested/app/views/posts/index.html.erb": `<div></div>\n`,
}

function project(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "herb-lsp-workspaces-"))

  roots.push(root)

  for (const [path, contents] of Object.entries(files)) {
    const file = join(root, path)

    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, contents, "utf-8")
  }

  return root
}

function settingsFor(folder: string): Settings {
  const params = {
    processId: null,
    rootUri: null,
    capabilities: {},
    workspaceFolders: [{ uri: pathToFileURL(folder).toString(), name: "outer" }],
  } as unknown as InitializeParams

  return new Settings(params, connection)
}

function registryWith(_folder: string, settings: Settings): Workspaces {
  const parserService = new ParserService()

  return new Workspaces(connection, settings, {
    documentService: { documents: {}, get: () => undefined } as unknown as DocumentService,
    parserService,
    definitionService: new DefinitionService(parserService),
  })
}

function registryFor(folder: string): Workspaces {
  return registryWith(folder, settingsFor(folder))
}

function uriFor(folder: string, path: string): string {
  return pathToFileURL(join(folder, path)).toString()
}

beforeAll(async () => {
  await Herb.load()
})

afterEach(() => {
  while (roots.length > 0) {
    rmSync(roots.pop()!, { recursive: true, force: true })
  }
})

describe("Workspaces", () => {
  test("resolves a document to the directory holding its `.herb.yml`", async () => {
    const folder = project(FILES)
    const workspaces = registryFor(folder)

    const workspace = await workspaces.ensure(uriFor(folder, "app/views/posts/index.html.erb"))

    expect(workspace?.root).toBe(folder)
  })

  test("gives a nested project its own workspace", async () => {
    const folder = project(FILES)
    const workspaces = registryFor(folder)

    const outer = await workspaces.ensure(uriFor(folder, "app/views/posts/index.html.erb"))
    const inner = await workspaces.ensure(uriFor(folder, "nested/app/views/posts/index.html.erb"))

    expect(inner?.root).toBe(join(folder, "nested"))
    expect(inner).not.toBe(outer)
    expect(workspaces.all()).toHaveLength(2)
  })

  test("reuses the workspace for another document under the same root", async () => {
    const folder = project(FILES)
    const workspaces = registryFor(folder)

    const first = await workspaces.ensure(uriFor(folder, "app/views/posts/index.html.erb"))
    const second = await workspaces.ensure(uriFor(folder, "app/views/posts/_outer.html.erb"))

    expect(second).toBe(first)
    expect(workspaces.all()).toHaveLength(1)
  })

  test("loads each project's own config", async () => {
    const folder = project(FILES)
    const workspaces = registryFor(folder)

    const outer = await workspaces.ensure(uriFor(folder, "app/views/posts/index.html.erb"))
    const inner = await workspaces.ensure(uriFor(folder, "nested/app/views/posts/index.html.erb"))

    expect(outer?.config?.config?.linter?.rules?.["html-tag-name-lowercase"]).toEqual({ enabled: false })
    expect(inner?.config?.config?.linter?.rules?.["html-tag-name-lowercase"]).toEqual({ enabled: true })
  })

  test("indexes only the partials belonging to each project", async () => {
    const folder = project(FILES)
    const workspaces = registryFor(folder)

    const outer = await workspaces.ensure(uriFor(folder, "app/views/posts/index.html.erb"))
    const inner = await workspaces.ensure(uriFor(folder, "nested/app/views/posts/index.html.erb"))

    expect(outer?.partialIndexService.index?.lookup("posts/outer", undefined)).not.toBeNull()
    expect(outer?.partialIndexService.index?.lookup("posts/inner", undefined)).toBeNull()

    expect(inner?.partialIndexService.index?.lookup("posts/inner", undefined)).not.toBeNull()
    expect(inner?.partialIndexService.index?.lookup("posts/outer", undefined)).toBeNull()
  })

  test("refuses a document outside every workspace folder", async () => {
    const folder = project(FILES)
    const workspaces = registryFor(folder)

    expect(await workspaces.ensure("file:///somewhere/else/a.html.erb")).toBeNull()
  })

  test("refuses a document that does not live on disk", async () => {
    const folder = project(FILES)
    const workspaces = registryFor(folder)

    expect(await workspaces.ensure("untitled:Untitled-1")).toBeNull()
  })

  test("drops the projects of a folder the client closed", async () => {
    const folder = project(FILES)
    const settings = settingsFor(folder)
    const workspaces = registryWith(folder, settings)

    await workspaces.ensure(uriFor(folder, "app/views/posts/index.html.erb"))
    await workspaces.ensure(uriFor(folder, "nested/app/views/posts/index.html.erb"))

    expect(workspaces.all()).toHaveLength(2)

    settings.updateWorkspaceFolders({ added: [], removed: [{ uri: pathToFileURL(folder).toString(), name: "outer" }] })

    expect(workspaces.prune()).toHaveLength(2)
    expect(workspaces.all()).toHaveLength(0)
  })

  test("keeps the projects of a folder that stayed open", async () => {
    const folder = project(FILES)
    const settings = settingsFor(folder)
    const workspaces = registryWith(folder, settings)

    await workspaces.ensure(uriFor(folder, "app/views/posts/index.html.erb"))

    settings.updateWorkspaceFolders({ added: [{ uri: "file:///elsewhere", name: "other" }], removed: [] })

    expect(workspaces.prune()).toEqual([])
    expect(workspaces.all()).toHaveLength(1)
  })

  test("resolves a document in a folder added after initialize", async () => {
    const folder = project(FILES)
    const settings = settingsFor("/nowhere")
    const workspaces = registryWith(folder, settings)

    expect(await workspaces.ensure(uriFor(folder, "app/views/posts/index.html.erb"))).toBeNull()

    settings.updateWorkspaceFolders({ added: [{ uri: pathToFileURL(folder).toString(), name: "outer" }], removed: [] })

    expect((await workspaces.ensure(uriFor(folder, "app/views/posts/index.html.erb")))?.root).toBe(folder)
  })

  test("hands concurrent callers the same fully indexed workspace", async () => {
    const folder = project(FILES)
    const workspaces = registryFor(folder)

    const first = workspaces.ensure(uriFor(folder, "app/views/posts/index.html.erb"))

    const indexedOnResolve = workspaces
      .ensure(uriFor(folder, "app/views/posts/_outer.html.erb"))
      .then(workspace => workspace!.partialIndexService.index?.size ?? 0)

    expect(await indexedOnResolve).toBeGreaterThan(0)
    expect(await first).toBe(await workspaces.ensure(uriFor(folder, "app/views/posts/_outer.html.erb")))
    expect(workspaces.all()).toHaveLength(1)
  })

  test("resolves the innermost project for a path under both", async () => {
    const folder = project(FILES)
    const workspaces = registryFor(folder)

    await workspaces.ensure(uriFor(folder, "app/views/posts/index.html.erb"))
    await workspaces.ensure(uriFor(folder, "nested/app/views/posts/index.html.erb"))

    expect(workspaces.containing(join(folder, "nested/app/views/posts/index.html.erb"))?.root).toBe(join(folder, "nested"))
  })
})
