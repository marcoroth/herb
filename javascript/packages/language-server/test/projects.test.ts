import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, dirname } from "node:path"
import { pathToFileURL } from "node:url"

import { beforeAll, afterEach, describe, expect, test, vi } from "vitest"

import { Herb } from "@herb-tools/node-wasm"
import { TextDocument } from "vscode-languageserver-textdocument"

import { Projects } from "../src/projects"
import { WorkspaceFolders } from "../src/workspace_folders"
import { UserSettings } from "../src/user_settings"
import { Capabilities } from "../src/capabilities"
import { ParserService } from "@herb-tools/language-service"
import { DefinitionProvider } from "@herb-tools/language-service"

import type { Connection, InitializeParams } from "vscode-languageserver/node"
import type { Documents } from "../src/documents"

function readFile(filePath: string): string | null {
  try {
    return readFileSync(filePath, "utf-8")
  } catch {
    return null
  }
}

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

function workspaceFolder(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "herb-lsp-projects-"))

  roots.push(root)

  for (const [path, contents] of Object.entries(files)) {
    const file = join(root, path)

    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, contents, "utf-8")
  }

  return root
}

function foldersFor(folder: string): WorkspaceFolders {
  const params = {
    processId: null,
    rootUri: null,
    capabilities: {},
    workspaceFolders: [{ uri: pathToFileURL(folder).toString(), name: "outer" }],
  } as unknown as InitializeParams

  return new WorkspaceFolders(params)
}

function registryWith(_folder: string, workspaceFolders: WorkspaceFolders, parserService = new ParserService(Herb)): Projects {
  const capabilities = new Capabilities({ capabilities: {} } as InitializeParams)

  return new Projects(connection, workspaceFolders, {
    documents: { documents: {}, get: () => undefined } as unknown as Documents,
    parserService,
    definitionProvider: new DefinitionProvider(parserService, existsSync, readFile),
    userSettings: new UserSettings(connection, capabilities),
    capabilities,
    readFile,
  })
}

function registryFor(folder: string, parserService?: ParserService): Projects {
  return registryWith(folder, foldersFor(folder), parserService)
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

describe("Projects", () => {
  test("resolves a document to the directory holding its `.herb.yml`", async () => {
    const folder = workspaceFolder(FILES)
    const projects = registryFor(folder)

    const project = await projects.ensure(uriFor(folder, "app/views/posts/index.html.erb"))

    expect(project?.root).toBe(folder)
  })

  test("gives a nested project its own project", async () => {
    const folder = workspaceFolder(FILES)
    const projects = registryFor(folder)

    const outer = await projects.ensure(uriFor(folder, "app/views/posts/index.html.erb"))
    const inner = await projects.ensure(uriFor(folder, "nested/app/views/posts/index.html.erb"))

    expect(inner?.root).toBe(join(folder, "nested"))
    expect(inner).not.toBe(outer)
    expect(projects.all()).toHaveLength(2)
  })

  test("reuses the project for another document under the same root", async () => {
    const folder = workspaceFolder(FILES)
    const projects = registryFor(folder)

    const first = await projects.ensure(uriFor(folder, "app/views/posts/index.html.erb"))
    const second = await projects.ensure(uriFor(folder, "app/views/posts/_outer.html.erb"))

    expect(second).toBe(first)
    expect(projects.all()).toHaveLength(1)
  })

  test("loads each project's own config", async () => {
    const folder = workspaceFolder(FILES)
    const projects = registryFor(folder)

    const outer = await projects.ensure(uriFor(folder, "app/views/posts/index.html.erb"))
    const inner = await projects.ensure(uriFor(folder, "nested/app/views/posts/index.html.erb"))

    expect(outer?.config?.config?.linter?.rules?.["html-tag-name-lowercase"]).toEqual({ enabled: false })
    expect(inner?.config?.config?.linter?.rules?.["html-tag-name-lowercase"]).toEqual({ enabled: true })
  })

  test("indexes only the partials belonging to each project", async () => {
    const folder = workspaceFolder(FILES)
    const projects = registryFor(folder)

    const outer = await projects.ensure(uriFor(folder, "app/views/posts/index.html.erb"))
    const inner = await projects.ensure(uriFor(folder, "nested/app/views/posts/index.html.erb"))

    expect(outer?.index.partials?.lookup("posts/outer", undefined)).not.toBeNull()
    expect(outer?.index.partials?.lookup("posts/inner", undefined)).toBeNull()

    expect(inner?.index.partials?.lookup("posts/inner", undefined)).not.toBeNull()
    expect(inner?.index.partials?.lookup("posts/outer", undefined)).toBeNull()
  })

  test("refuses a document outside every workspace folder", async () => {
    const folder = workspaceFolder(FILES)
    const projects = registryFor(folder)

    expect(await projects.ensure("file:///somewhere/else/a.html.erb")).toBeNull()
  })

  test("refuses a document that does not live on disk", async () => {
    const folder = workspaceFolder(FILES)
    const projects = registryFor(folder)

    expect(await projects.ensure("untitled:Untitled-1")).toBeNull()
  })

  test("drops the projects of a folder the client closed", async () => {
    const folder = workspaceFolder(FILES)
    const folders = foldersFor(folder)
    const projects = registryWith(folder, folders)

    await projects.ensure(uriFor(folder, "app/views/posts/index.html.erb"))
    await projects.ensure(uriFor(folder, "nested/app/views/posts/index.html.erb"))

    expect(projects.all()).toHaveLength(2)

    folders.update({ added: [], removed: [{ uri: pathToFileURL(folder).toString(), name: "outer" }] })

    expect(projects.prune()).toHaveLength(2)
    expect(projects.all()).toHaveLength(0)
  })

  test("keeps the projects of a folder that stayed open", async () => {
    const folder = workspaceFolder(FILES)
    const folders = foldersFor(folder)
    const projects = registryWith(folder, folders)

    await projects.ensure(uriFor(folder, "app/views/posts/index.html.erb"))

    folders.update({ added: [{ uri: "file:///elsewhere", name: "other" }], removed: [] })

    expect(projects.prune()).toEqual([])
    expect(projects.all()).toHaveLength(1)
  })

  test("resolves a document in a folder added after initialize", async () => {
    const folder = workspaceFolder(FILES)
    const folders = foldersFor("/nowhere")
    const projects = registryWith(folder, folders)

    expect(await projects.ensure(uriFor(folder, "app/views/posts/index.html.erb"))).toBeNull()

    folders.update({ added: [{ uri: pathToFileURL(folder).toString(), name: "outer" }], removed: [] })

    expect((await projects.ensure(uriFor(folder, "app/views/posts/index.html.erb")))?.root).toBe(folder)
  })

  test("hands concurrent callers the same fully indexed project", async () => {
    const folder = workspaceFolder(FILES)
    const projects = registryFor(folder)

    const first = projects.ensure(uriFor(folder, "app/views/posts/index.html.erb"))

    const indexedOnResolve = projects
      .ensure(uriFor(folder, "app/views/posts/_outer.html.erb"))
      .then(project => project!.index.partials?.size ?? 0)

    expect(await indexedOnResolve).toBeGreaterThan(0)
    expect(await first).toBe(await projects.ensure(uriFor(folder, "app/views/posts/_outer.html.erb")))
    expect(projects.all()).toHaveLength(1)
  })

  describe("parser options", () => {
    const GRAPHQL_TEMPLATE = `<%graphql query Products($first: Int!) { products(first: $first) { id } } %>`

    const PARSER_FILES = {
      ".herb.yml": OUTER_CONFIG,
      "app/views/posts/index.html.erb": GRAPHQL_TEMPLATE,
      "storefront/.herb.yml": `parser:\n  erb_openers:\n    - graphql\n`,
      "storefront/app/views/products/index.html.erb": GRAPHQL_TEMPLATE,
    }

    const PLAIN = "app/views/posts/index.html.erb"
    const STOREFRONT = "storefront/app/views/products/index.html.erb"

    function documentFor(folder: string, path: string): TextDocument {
      return TextDocument.create(uriFor(folder, path), "erb", 1, GRAPHQL_TEMPLATE)
    }

    test("parses a document with the openers its own project names", async () => {
      const folder = workspaceFolder(PARSER_FILES)
      const parserService = new ParserService(Herb)
      const projects = registryFor(folder, parserService)

      await projects.ensure(uriFor(folder, STOREFRONT))
      await projects.ensure(uriFor(folder, PLAIN))

      expect(parserService.parseDocument(documentFor(folder, STOREFRONT)).diagnostics).toEqual([])
    })

    test("leaves a document in a sibling project on the default openers", async () => {
      const folder = workspaceFolder(PARSER_FILES)
      const parserService = new ParserService(Herb)
      const projects = registryFor(folder, parserService)

      await projects.ensure(uriFor(folder, PLAIN))
      await projects.ensure(uriFor(folder, STOREFRONT))

      expect(parserService.parseDocument(documentFor(folder, PLAIN)).diagnostics.length).toBeGreaterThan(0)
    })

    test("parses a fragment with the openers of the document it came from", async () => {
      const folder = workspaceFolder(PARSER_FILES)
      const parserService = new ParserService(Herb)
      const projects = registryFor(folder, parserService)

      await projects.ensure(uriFor(folder, STOREFRONT))
      await projects.ensure(uriFor(folder, PLAIN))

      expect(parserService.parseContent(GRAPHQL_TEMPLATE, undefined, uriFor(folder, STOREFRONT)).recursiveErrors()).toEqual([])
      expect(parserService.parseContent(GRAPHQL_TEMPLATE, undefined, uriFor(folder, PLAIN)).recursiveErrors().length).toBeGreaterThan(0)
    })

    test("picks up openers that are added to a project while the server runs", async () => {
      const folder = workspaceFolder(PARSER_FILES)
      const parserService = new ParserService(Herb)
      const projects = registryFor(folder, parserService)

      const project = await projects.ensure(uriFor(folder, PLAIN))

      expect(parserService.parseDocument(documentFor(folder, PLAIN)).diagnostics.length).toBeGreaterThan(0)

      writeFileSync(join(folder, ".herb.yml"), `parser:\n  erb_openers:\n    - graphql\n`, "utf-8")
      await project!.refreshConfig()

      expect(parserService.parseDocument(documentFor(folder, PLAIN)).diagnostics).toEqual([])
    })

    test("leaves a document outside every project on the default openers", async () => {
      const folder = workspaceFolder(PARSER_FILES)
      const parserService = new ParserService(Herb)
      const projects = registryFor(folder, parserService)

      await projects.ensure(uriFor(folder, STOREFRONT))

      const outside = TextDocument.create("file:///somewhere/else/a.html.erb", "erb", 1, GRAPHQL_TEMPLATE)

      expect(parserService.parseDocument(outside).diagnostics.length).toBeGreaterThan(0)
    })

    test("answers which config covers a document", async () => {
      const folder = workspaceFolder(PARSER_FILES)
      const projects = registryFor(folder)

      await projects.ensure(uriFor(folder, PLAIN))
      await projects.ensure(uriFor(folder, STOREFRONT))

      expect(projects.configFor(uriFor(folder, STOREFRONT))?.parserOptions?.erb_openers).toEqual(["graphql"])
      expect(projects.configFor(uriFor(folder, PLAIN))?.parserOptions?.erb_openers).toBeUndefined()
      expect(projects.configFor("file:///somewhere/else/a.html.erb")).toBeUndefined()
    })
  })

  test("resolves the innermost project for a path under both", async () => {
    const folder = workspaceFolder(FILES)
    const projects = registryFor(folder)

    await projects.ensure(uriFor(folder, "app/views/posts/index.html.erb"))
    await projects.ensure(uriFor(folder, "nested/app/views/posts/index.html.erb"))

    expect(projects.containing(join(folder, "nested/app/views/posts/index.html.erb"))?.root).toBe(join(folder, "nested"))
  })
})
