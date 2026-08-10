import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, dirname } from "node:path"
import { pathToFileURL } from "node:url"

import { beforeAll, afterEach, describe, expect, test, vi } from "vitest"

import { Herb } from "@herb-tools/node-wasm"

import { PartialCallerIndexService } from "../src/partial_caller_index_service"
import { PartialIndexService } from "../src/partial_index_service"
import { Project } from "../src/project"

import type { Connection } from "vscode-languageserver/node"

const CARD = "app/views/posts/_card.html.erb"
const INDEX = "app/views/posts/index.html.erb"
const SHOW = "app/views/events/show.html.erb"

const roots: string[] = []

const connection = {
  console: { log: vi.fn(), warn: vi.fn(), error: vi.fn() }
} as unknown as Connection

const PROJECT = {
  [CARD]: `<article></article>\n`,
  [INDEX]: `<%= render "posts/card" %>\n`,
  [SHOW]: `<div></div>\n`,
}

function project(files: Record<string, string>): Project {
  const root = mkdtempSync(join(tmpdir(), "herb-lsp-callers-"))

  roots.push(root)

  for (const [path, contents] of Object.entries(files)) {
    const file = join(root, path)

    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, contents, "utf-8")
  }

  return { projectPath: root, herbBackend: Herb } as Project
}

async function serviceFor(files: Record<string, string>): Promise<{ service: PartialCallerIndexService, project: Project }> {
  const created = project(files)
  const partials = new PartialIndexService(connection, created)

  await partials.initialize()

  const service = new PartialCallerIndexService(connection, created, partials)

  await service.initialize()

  return { service, project: created }
}

function uriFor(project: Project, path: string): string {
  return pathToFileURL(join(project.projectPath, path)).toString()
}

function callers(service: PartialCallerIndexService, partial = CARD): string[] {
  return (service.index?.callersOf(partial) ?? []).map(callSite => callSite.caller)
}

beforeAll(async () => {
  await Herb.load()
})

afterEach(() => {
  while (roots.length > 0) {
    rmSync(roots.pop()!, { recursive: true, force: true })
  }
})

describe("PartialCallerIndexService", () => {
  test("indexes the project's render call sites on initialize", async () => {
    const { service } = await serviceFor(PROJECT)

    expect(callers(service)).toEqual([INDEX])
  })

  test("records a call site added in an unsaved buffer", async () => {
    const { service, project } = await serviceFor(PROJECT)

    expect(service.updateFromSource(uriFor(project, SHOW), `<%= render "posts/card" %>\n`)).toBe(true)
    expect(callers(service).sort()).toEqual([SHOW, INDEX])
  })

  test("drops a call site removed in an unsaved buffer", async () => {
    const { service, project } = await serviceFor(PROJECT)

    expect(service.updateFromSource(uriFor(project, INDEX), `<div></div>\n`)).toBe(true)
    expect(callers(service)).toEqual([])
  })

  test("reports no change when a buffer's call sites are unchanged", async () => {
    const { service, project } = await serviceFor(PROJECT)

    expect(service.updateFromSource(uriFor(project, SHOW), `<p></p>\n`)).toBe(false)
  })

  test("ignores files that are not templates", async () => {
    const { service, project } = await serviceFor(PROJECT)

    expect(service.updateFromSource(uriFor(project, "app/models/post.rb"), `render "posts/card"\n`)).toBe(false)
    expect(callers(service)).toEqual([INDEX])
  })

  test("ignores files outside the project", async () => {
    const { service } = await serviceFor(PROJECT)

    expect(service.updateFromSource("file:///elsewhere/show.html.erb", `<%= render "posts/card" %>\n`)).toBe(false)
  })

  test("picks up a call site written to disk", async () => {
    const { service, project } = await serviceFor(PROJECT)

    writeFileSync(join(project.projectPath, SHOW), `<%= render "posts/card" %>\n`, "utf-8")

    expect(service.updateFromDisk(uriFor(project, SHOW))).toBe(true)
    expect(callers(service).sort()).toEqual([SHOW, INDEX])
  })

  test("forgets a deleted caller", async () => {
    const { service, project } = await serviceFor(PROJECT)

    expect(service.remove(uriFor(project, INDEX))).toBe(true)
    expect(callers(service)).toEqual([])
  })

  test("forgets the callers of a deleted partial", async () => {
    const { service, project } = await serviceFor(PROJECT)

    expect(service.remove(uriFor(project, CARD))).toBe(true)
    expect(callers(service)).toEqual([])
  })

  test("keeps the index usable when a buffer does not parse", async () => {
    const { service, project } = await serviceFor(PROJECT)

    service.updateFromSource(uriFor(project, SHOW), `<%= render "posts/card"\n`)

    expect(service.index).toBeDefined()
    expect(callers(service)).toContain(INDEX)
  })
})
