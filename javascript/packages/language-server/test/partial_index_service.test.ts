import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, dirname } from "node:path"
import { pathToFileURL } from "node:url"

import { beforeAll, afterEach, describe, expect, test, vi } from "vitest"

import { Herb } from "@herb-tools/node-wasm"

import { PartialIndexService } from "../src/partial_index_service"
import { Project } from "../src/project"

import type { Connection } from "vscode-languageserver/node"

const roots: string[] = []

const connection = {
  console: { log: vi.fn(), warn: vi.fn(), error: vi.fn() }
} as unknown as Connection

function project(files: Record<string, string>): Project {
  const root = mkdtempSync(join(tmpdir(), "herb-lsp-partials-"))

  roots.push(root)

  for (const [path, contents] of Object.entries(files)) {
    const file = join(root, path)

    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, contents, "utf-8")
  }

  return { projectPath: root, herbBackend: Herb } as Project
}

function uriFor(project: Project, path: string): string {
  return pathToFileURL(join(project.projectPath, path)).toString()
}

async function serviceFor(files: Record<string, string>): Promise<{ service: PartialIndexService, project: Project }> {
  const created = project(files)
  const service = new PartialIndexService(connection, created)

  await service.initialize()

  return { service, project: created }
}

beforeAll(async () => {
  await Herb.load()
})

afterEach(() => {
  while (roots.length > 0) {
    rmSync(roots.pop()!, { recursive: true, force: true })
  }
})

describe("PartialIndexService", () => {
  test("indexes the project's partials on initialize", async () => {
    const { service } = await serviceFor({
      "app/views/users/_card.html.erb": `<%# locals: (user:) %>\n`,
      "app/views/posts/index.html.erb": `<div></div>\n`,
    })

    expect(service.index?.size).toBe(1)
    expect(service.index?.lookup("users/card", "app/views/posts/index.html.erb")?.locals).toEqual([{ name: "user", required: true }])
  })

  test("converts a document URI to a project relative path", async () => {
    const { service, project } = await serviceFor({ "app/views/users/_card.html.erb": `<%# locals: (user:) %>\n` })

    expect(service.relativePathFor(uriFor(project, "app/views/posts/index.html.erb"))).toBe("app/views/posts/index.html.erb")
  })

  test("returns null for a URI outside the project", async () => {
    const { service } = await serviceFor({ "app/views/users/_card.html.erb": `<%# locals: (user:) %>\n` })

    expect(service.relativePathFor("file:///somewhere/else/_card.html.erb")).toBeNull()
  })

  test("returns null for a non file URI", async () => {
    const { service } = await serviceFor({ "app/views/users/_card.html.erb": `<%# locals: (user:) %>\n` })

    expect(service.relativePathFor("untitled:Untitled-1")).toBeNull()
  })

  test("updates a declaration from unsaved buffer contents", async () => {
    const { service, project } = await serviceFor({ "app/views/users/_card.html.erb": `<%# locals: (user:) %>\n` })

    expect(service.updateFromSource(uriFor(project, "app/views/users/_card.html.erb"), `<%# locals: (user:, size:) %>\n`)).toBe(true)

    expect(service.index?.lookup("users/card", "app/views/posts/index.html.erb")?.locals).toEqual([
      { name: "user", required: true },
      { name: "size", required: true },
    ])
  })

  test("ignores changes to templates that are not partials", async () => {
    const { service, project } = await serviceFor({ "app/views/users/_card.html.erb": `<%# locals: (user:) %>\n` })

    expect(service.updateFromSource(uriFor(project, "app/views/posts/index.html.erb"), `<div></div>\n`)).toBe(false)
    expect(service.index?.size).toBe(1)
  })

  test("ignores changes to files outside the project", async () => {
    const { service } = await serviceFor({ "app/views/users/_card.html.erb": `<%# locals: (user:) %>\n` })

    expect(service.updateFromSource("file:///elsewhere/_card.html.erb", `<%# locals: (user:) %>\n`)).toBe(false)
  })

  test("picks up a partial created on disk", async () => {
    const { service, project } = await serviceFor({ "app/views/users/_card.html.erb": `<%# locals: (user:) %>\n` })

    writeFileSync(join(project.projectPath, "app/views/users/_avatar.html.erb"), `<%# locals: (user:) %>\n`, "utf-8")

    expect(service.updateFromDisk(uriFor(project, "app/views/users/_avatar.html.erb"))).toBe(true)
    expect(service.index?.size).toBe(2)
  })

  test("drops a partial deleted from disk", async () => {
    const { service, project } = await serviceFor({ "app/views/users/_card.html.erb": `<%# locals: (user:) %>\n` })

    expect(service.remove(uriFor(project, "app/views/users/_card.html.erb"))).toBe(true)
    expect(service.index?.lookup("users/card", "app/views/posts/index.html.erb")).toBeNull()
  })

  test("reports no change when removing something it never indexed", async () => {
    const { service, project } = await serviceFor({ "app/views/users/_card.html.erb": `<%# locals: (user:) %>\n` })

    expect(service.remove(uriFor(project, "app/views/users/_avatar.html.erb"))).toBe(false)
  })

  test("stays usable when the project has no partials", async () => {
    const { service, project } = await serviceFor({ "app/views/posts/index.html.erb": `<div></div>\n` })

    expect(service.index?.size).toBe(0)
    expect(service.updateFromSource(uriFor(project, "app/views/posts/index.html.erb"), `<div></div>\n`)).toBe(false)
  })
})
