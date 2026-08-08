import { beforeAll, afterEach, describe, expect, test, vi } from "vitest"

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, dirname, relative } from "node:path"
import { pathToFileURL, fileURLToPath } from "node:url"

import { Herb } from "@herb-tools/node-wasm"
import { TextDocument } from "vscode-languageserver-textdocument"

import { Project } from "../src/project"
import { DocumentService } from "../src/document_service"
import { ReferencesService } from "../src/references_service"
import { DefinitionService } from "../src/definition_service"
import { ParserService } from "../src/parser_service"
import { PartialIndexService } from "../src/partial_index_service"
import { PartialCallerIndexService } from "../src/partial_caller_index_service"

import type { Connection, Location } from "vscode-languageserver/node"

const roots: string[] = []

const connection = {
  console: { log: vi.fn(), warn: vi.fn(), error: vi.fn() }
} as unknown as Connection

const PROJECT = {
  "app/views/posts/_card.html.erb": `<%# locals: (post:) %>\n<article><%= post.title %></article>\n`,
  "app/views/posts/_badge.html.erb": `<span>badge</span>\n`,
  "app/views/posts/index.html.erb": `<% @posts.each do |post| %>\n  <%= render "posts/card", post: post %>\n<% end %>\n\n<%= render partial: "posts/card", locals: { post: @featured } %>\n`,
  "app/views/events/show.html.erb": `<%= render "posts/card", post: @post %>\n`,
  "app/views/other/index.html.erb": `<%= render "posts/badge" %>\n`,
}

let parserService: ParserService

function project(files: Record<string, string>): Project {
  const root = mkdtempSync(join(tmpdir(), "herb-lsp-references-"))

  roots.push(root)

  for (const [path, contents] of Object.entries(files)) {
    const file = join(root, path)

    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, contents, "utf-8")
  }

  return { projectPath: root, herbBackend: Herb } as Project
}

interface Services {
  service: ReferencesService
  callers: PartialCallerIndexService
  project: Project
  buffers: Record<string, string>
}

async function serviceFor(files: Record<string, string>, buffers: Record<string, string> = {}): Promise<Services> {
  const created = project(files)
  const partials = new PartialIndexService(connection, created)

  await partials.initialize()

  const callers = new PartialCallerIndexService(connection, created, partials)

  await callers.initialize()

  const open = new Map(Object.entries(buffers).map(([path, contents]) => {
    const uri = uriFor(created, path)

    return [uri, TextDocument.create(uri, "erb", 2, contents)]
  }))

  const documents = {
    get: (uri: string) => open.get(uri)
  } as unknown as DocumentService

  const service = new ReferencesService(created, new DefinitionService(parserService), partials, callers, documents)

  return { service, callers, project: created, buffers }
}

function uriFor(project: Project, path: string): string {
  return pathToFileURL(join(project.projectPath, path)).toString()
}

function documentFor(services: Services, path: string): TextDocument {
  const source = services.buffers[path] ?? readFileSync(join(services.project.projectPath, path), "utf-8")

  return TextDocument.create(uriFor(services.project, path), "erb", 1, source)
}

function referencesAt(services: Services, path: string, target?: string, includeDeclaration = false): string[] {
  const document = documentFor(services, path)
  const position = target ? document.positionAt(document.getText().indexOf(target) + 1) : { line: 0, character: 0 }

  return describeAll(services, services.service.getReferences(document, position, includeDeclaration))
}

function describeAll(services: Services, locations: Location[]): string[] {
  return locations.map(location => {
    const path = relative(services.project.projectPath, fileURLToPath(location.uri))
    const document = documentFor(services, path)

    return `${path}:${location.range.start.line} ${document.getText(location.range)}`
  })
}

beforeAll(async () => {
  await Herb.load()

  parserService = new ParserService()
})

afterEach(() => {
  while (roots.length > 0) {
    rmSync(roots.pop()!, { recursive: true, force: true })
  }
})

describe("ReferencesService", () => {
  test("finds every render call site of the partial the cursor is in", async () => {
    const services = await serviceFor(PROJECT)

    expect(referencesAt(services, "app/views/posts/_card.html.erb")).toEqual([
      "app/views/events/show.html.erb:0 posts/card",
      "app/views/posts/index.html.erb:1 posts/card",
      "app/views/posts/index.html.erb:4 posts/card",
    ])
  })

  test("finds the same call sites from a render call", async () => {
    const services = await serviceFor(PROJECT)

    expect(referencesAt(services, "app/views/events/show.html.erb", "posts/card")).toEqual([
      "app/views/events/show.html.erb:0 posts/card",
      "app/views/posts/index.html.erb:1 posts/card",
      "app/views/posts/index.html.erb:4 posts/card",
    ])
  })

  test("does not report call sites of a different partial", async () => {
    const services = await serviceFor(PROJECT)

    expect(referencesAt(services, "app/views/posts/_badge.html.erb")).toEqual([
      "app/views/other/index.html.erb:0 posts/badge",
    ])
  })

  test("includes the partial itself when the client asks for the declaration", async () => {
    const services = await serviceFor(PROJECT)

    expect(referencesAt(services, "app/views/posts/_badge.html.erb", undefined, true)).toEqual([
      "app/views/posts/_badge.html.erb:0 ",
      "app/views/other/index.html.erb:0 posts/badge",
    ])
  })

  test("resolves a partial rendered by its unqualified name", async () => {
    const services = await serviceFor({
      "app/views/posts/_card.html.erb": `<article></article>\n`,
      "app/views/posts/index.html.erb": `<%= render "card" %>\n`,
    })

    expect(referencesAt(services, "app/views/posts/_card.html.erb")).toEqual([
      "app/views/posts/index.html.erb:0 card",
    ])
  })

  test("returns nothing for a template that is not a partial", async () => {
    const services = await serviceFor(PROJECT)

    expect(referencesAt(services, "app/views/posts/index.html.erb", "@posts")).toEqual([])
  })

  test("returns nothing for a render whose partial name is not a literal", async () => {
    const services = await serviceFor({
      "app/views/posts/_card.html.erb": `<article></article>\n`,
      "app/views/posts/index.html.erb": `<%= render @post %>\n`,
    })

    expect(referencesAt(services, "app/views/posts/index.html.erb", "@post")).toEqual([])
  })

  test("takes the range from an unsaved buffer rather than from disk", async () => {
    const services = await serviceFor(PROJECT, {
      "app/views/events/show.html.erb": `<div>\n</div>\n<%= render "posts/card", post: @post %>\n`
    })

    expect(referencesAt(services, "app/views/posts/_card.html.erb")).toEqual([
      "app/views/events/show.html.erb:2 posts/card",
      "app/views/posts/index.html.erb:1 posts/card",
      "app/views/posts/index.html.erb:4 posts/card",
    ])
  })

  test("takes the range of the edited document from the request, not from disk", async () => {
    const services = await serviceFor(PROJECT)
    const edited = `<div>\n</div>\n<%= render "posts/card", post: @post %>\n`
    const document = TextDocument.create(uriFor(services.project, "app/views/events/show.html.erb"), "erb", 3, edited)
    const position = document.positionAt(edited.indexOf("posts/card") + 1)

    const located = services.service.getReferences(document, position, false)
      .filter(location => location.uri === document.uri)
      .map(location => `${location.range.start.line} ${document.getText(location.range)}`)

    expect(located).toEqual(["2 posts/card"])
  })

  test("picks up a call site added to an open buffer", async () => {
    const buffer = `<%= render "posts/badge" %>\n<%= render "posts/card" %>\n`
    const services = await serviceFor(PROJECT, { "app/views/other/index.html.erb": buffer })

    services.callers.updateFromSource(uriFor(services.project, "app/views/other/index.html.erb"), buffer)

    expect(referencesAt(services, "app/views/posts/_card.html.erb")).toEqual([
      "app/views/events/show.html.erb:0 posts/card",
      "app/views/other/index.html.erb:1 posts/card",
      "app/views/posts/index.html.erb:1 posts/card",
      "app/views/posts/index.html.erb:4 posts/card",
    ])
  })

  test("drops a call site removed from an open buffer", async () => {
    const services = await serviceFor(PROJECT, { "app/views/events/show.html.erb": `<div></div>\n` })

    services.callers.updateFromSource(uriFor(services.project, "app/views/events/show.html.erb"), `<div></div>\n`)

    expect(referencesAt(services, "app/views/posts/_card.html.erb")).toEqual([
      "app/views/posts/index.html.erb:1 posts/card",
      "app/views/posts/index.html.erb:4 posts/card",
    ])
  })

  test("reports a spacer_template alongside the render that pulls the file into the index", async () => {
    const services = await serviceFor({
      "app/views/posts/_card.html.erb": `<article></article>\n`,
      "app/views/posts/index.html.erb": `<%= render partial: "posts/card" %>\n<%= render partial: "posts/list", spacer_template: "posts/card" %>\n`,
      "app/views/posts/_list.html.erb": `<ul></ul>\n`,
    })

    expect(referencesAt(services, "app/views/posts/_card.html.erb")).toEqual([
      "app/views/posts/index.html.erb:0 posts/card",
      "app/views/posts/index.html.erb:1 posts/card",
    ])
  })

  test("misses a partial that is only ever used as a spacer_template", async () => {
    const services = await serviceFor({
      "app/views/posts/_separator.html.erb": `<hr>\n`,
      "app/views/posts/_card.html.erb": `<article></article>\n`,
      "app/views/posts/index.html.erb": `<%= render partial: "posts/card", spacer_template: "posts/separator" %>\n`,
    })

    expect(referencesAt(services, "app/views/posts/_separator.html.erb")).toEqual([])
  })

  test("returns nothing when the project has no call sites for the partial", async () => {
    const services = await serviceFor({
      "app/views/posts/_card.html.erb": `<article></article>\n`,
      "app/views/posts/index.html.erb": `<div></div>\n`,
    })

    expect(referencesAt(services, "app/views/posts/_card.html.erb")).toEqual([])
  })
})
