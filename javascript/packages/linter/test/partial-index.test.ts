import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, dirname } from "node:path"

import { beforeAll, afterEach, describe, expect, test } from "vitest"

import { Herb } from "@herb-tools/node-wasm"

import { PartialIndex, declarationFromDocument } from "../src/partial-index.js"
import { buildPartialIndex, findViewRoot } from "../src/cli/partial-index-builder.js"

import type { PartialDeclaration } from "../src/partial-index.js"

const projects: string[] = []

function project(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "herb-partial-index-"))

  projects.push(root)

  for (const [path, contents] of Object.entries(files)) {
    const file = join(root, path)

    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, contents, "utf-8")
  }

  return root
}

function declaration(file: string, locals: PartialDeclaration["locals"]): PartialDeclaration {
  return { file, hasDeclaration: true, hasKeywordRest: false, locals }
}

beforeAll(async () => {
  await Herb.load()
})

afterEach(() => {
  while (projects.length > 0) {
    rmSync(projects.pop()!, { recursive: true, force: true })
  }
})

describe("PartialIndex", () => {
  const index = new PartialIndex("app/views", new Map([
    ["users/card", declaration("app/views/users/_card.html.erb", [{ name: "user", required: true }])],
    ["application/flash", declaration("app/views/application/_flash.html.erb", [{ name: "message", required: true }])],
  ]))

  test("looks a partial up by its fully qualified name", () => {
    expect(index.lookup("users/card", "app/views/posts/index.html.erb")?.file).toBe("app/views/users/_card.html.erb")
  })

  test("looks a partial up relative to the rendering template", () => {
    expect(index.lookup("card", "app/views/users/show.html.erb")?.file).toBe("app/views/users/_card.html.erb")
  })

  test("falls back to the application directory", () => {
    expect(index.lookup("flash", "app/views/posts/index.html.erb")?.file).toBe("app/views/application/_flash.html.erb")
  })

  test("returns null for an unknown partial", () => {
    expect(index.lookup("users/missing", "app/views/posts/index.html.erb")).toBeNull()
  })

  test("tolerates an unknown source file", () => {
    expect(index.lookup("users/card", undefined)?.file).toBe("app/views/users/_card.html.erb")
  })

  test("round trips through its serialized form", () => {
    const restored = PartialIndex.from(index.toJSON())

    expect(restored.viewRoot).toBe("app/views")
    expect(restored.size).toBe(2)
    expect(restored.lookup("users/card", "app/views/posts/index.html.erb")?.locals).toEqual([{ name: "user", required: true }])
  })

  test("survives structuredClone on its way into a worker", () => {
    const restored = PartialIndex.from(structuredClone(index.toJSON()))

    expect(restored.lookup("flash", "app/views/posts/index.html.erb")?.file).toBe("app/views/application/_flash.html.erb")
  })
})

describe("PartialIndex updates", () => {
  function index(): PartialIndex {
    return new PartialIndex("app/views", new Map([
      ["users/card", declaration("app/views/users/_card.html.erb", [{ name: "user", required: true }])],
    ]))
  }

  test("replaces the declaration of an indexed partial", () => {
    const partials = index()

    expect(partials.update(declaration("app/views/users/_card.html.erb", [
      { name: "user", required: true },
      { name: "size", required: true },
    ]))).toBe("users/card")

    expect(partials.lookup("users/card", "app/views/posts/index.html.erb")?.locals).toHaveLength(2)
    expect(partials.size).toBe(1)
  })

  test("adds a partial that was not indexed yet", () => {
    const partials = index()

    expect(partials.update(declaration("app/views/users/_avatar.html.erb", [{ name: "user", required: true }]))).toBe("users/avatar")
    expect(partials.lookup("users/avatar", "app/views/posts/index.html.erb")?.file).toBe("app/views/users/_avatar.html.erb")
    expect(partials.size).toBe(2)
  })

  test("indexes an added partial for relative and application lookups", () => {
    const partials = index()

    partials.update(declaration("app/views/application/_flash.html.erb", [{ name: "message", required: true }]))

    expect(partials.lookup("flash", "app/views/posts/index.html.erb")?.file).toBe("app/views/application/_flash.html.erb")
  })

  test("ignores a file that is not a partial", () => {
    const partials = index()

    expect(partials.update(declaration("app/views/users/show.html.erb", []))).toBeNull()
    expect(partials.size).toBe(1)
  })

  test("ignores a file outside the view root", () => {
    const partials = index()

    expect(partials.update(declaration("app/components/_card.html.erb", []))).toBeNull()
    expect(partials.size).toBe(1)
  })

  test("does not let a lower ranked template take over an indexed name", () => {
    const partials = index()

    expect(partials.update(declaration("app/views/users/_card.turbo_stream.erb", []))).toBeNull()
    expect(partials.lookup("users/card", "app/views/posts/index.html.erb")?.file).toBe("app/views/users/_card.html.erb")
  })

  test("does not let a variant take over from the base template", () => {
    const partials = index()

    expect(partials.update(declaration("app/views/users/_card.html+phone.erb", []))).toBeNull()
    expect(partials.update(declaration("app/views/users/_card.en.html.erb", []))).toBeNull()
    expect(partials.lookup("users/card", "app/views/posts/index.html.erb")?.file).toBe("app/views/users/_card.html.erb")
  })

  test("lets the base template take over from a variant", () => {
    const partials = new PartialIndex("app/views", new Map([
      ["users/card", declaration("app/views/users/_card.en.html.erb", [{ name: "user", required: true }])],
    ]))

    expect(partials.update(declaration("app/views/users/_card.html.erb", [{ name: "user", required: true }]))).toBe("users/card")
    expect(partials.lookup("users/card", "app/views/posts/index.html.erb")?.file).toBe("app/views/users/_card.html.erb")
    expect(partials.size).toBe(1)
  })

  test("forgets the displaced variant when the base template takes over", () => {
    const partials = new PartialIndex("app/views", new Map([
      ["users/card", declaration("app/views/users/_card.html+phone.erb", [])],
    ]))

    partials.update(declaration("app/views/users/_card.html.erb", []))

    expect(partials.remove("app/views/users/_card.html+phone.erb")).toBeNull()
    expect(partials.lookup("users/card", "app/views/posts/index.html.erb")?.file).toBe("app/views/users/_card.html.erb")
  })

  test("removes an indexed partial", () => {
    const partials = index()

    expect(partials.remove("app/views/users/_card.html.erb")).toBe("users/card")
    expect(partials.lookup("users/card", "app/views/posts/index.html.erb")).toBeNull()
    expect(partials.size).toBe(0)
  })

  test("ignores removing a file that does not hold the name", () => {
    const partials = index()

    expect(partials.remove("app/views/users/_card.turbo_stream.erb")).toBeNull()
    expect(partials.size).toBe(1)
  })

  test("ignores removing an unknown partial", () => {
    const partials = index()

    expect(partials.remove("app/views/users/_avatar.html.erb")).toBeNull()
    expect(partials.size).toBe(1)
  })

  test("handles a rename as a remove and an update", () => {
    const partials = index()

    partials.remove("app/views/users/_card.html.erb")
    partials.update(declaration("app/views/users/_tile.html.erb", [{ name: "user", required: true }]))

    expect(partials.lookup("users/card", "app/views/posts/index.html.erb")).toBeNull()
    expect(partials.lookup("users/tile", "app/views/posts/index.html.erb")?.file).toBe("app/views/users/_tile.html.erb")
  })

  test("carries updates into the serialized form", () => {
    const partials = index()

    partials.update(declaration("app/views/users/_avatar.html.erb", [{ name: "user", required: true }]))
    partials.remove("app/views/users/_card.html.erb")

    const restored = PartialIndex.from(structuredClone(partials.toJSON()))

    expect(restored.size).toBe(1)
    expect(restored.lookup("users/avatar", "app/views/posts/index.html.erb")?.file).toBe("app/views/users/_avatar.html.erb")
  })
})

describe("declarationFromDocument", () => {
  test("reads required and optional locals", () => {
    const result = Herb.parse(`<%# locals: (user:, size: "large") %>\n`, { strict_locals: true })

    expect(declarationFromDocument(result.value, "app/views/users/_card.html.erb")).toEqual({
      file: "app/views/users/_card.html.erb",
      hasDeclaration: true,
      hasKeywordRest: false,
      locals: [{ name: "user", required: true }, { name: "size", required: false }],
    })
  })

  test("records a keyword rest separately from the locals", () => {
    const result = Herb.parse(`<%# locals: (user:, **) %>\n`, { strict_locals: true })
    const declaration = declarationFromDocument(result.value, "app/views/users/_card.html.erb")

    expect(declaration.hasKeywordRest).toBe(true)
    expect(declaration.locals).toEqual([{ name: "user", required: true }])
  })

  test("reports a partial without a declaration", () => {
    const result = Herb.parse(`<div>Hello</div>\n`, { strict_locals: true })
    const declaration = declarationFromDocument(result.value, "app/views/users/_card.html.erb")

    expect(declaration.hasDeclaration).toBe(false)
    expect(declaration.locals).toEqual([])
  })

  test("reports an empty declaration as a declaration", () => {
    const result = Herb.parse(`<%# locals: () %>\n`, { strict_locals: true })
    const declaration = declarationFromDocument(result.value, "app/views/users/_card.html.erb")

    expect(declaration.hasDeclaration).toBe(true)
    expect(declaration.locals).toEqual([])
  })
})

describe("buildPartialIndex", () => {
  test("prefers the base template over every variant", async () => {
    const root = project({
      "app/views/users/_card.en.html.erb": `<%# locals: (locale_variant:) %>\n`,
      "app/views/users/_card.html+phone.erb": `<%# locals: (phone_variant:) %>\n`,
      "app/views/users/_card.json.erb": `<%# locals: (json_variant:) %>\n`,
      "app/views/users/_card.turbo_stream.erb": `<%# locals: (turbo_variant:) %>\n`,
      "app/views/users/_card.html.erb": `<%# locals: (user:) %>\n`,
    })

    const index = await buildPartialIndex(Herb, root)

    expect(index.size).toBe(1)
    expect(index.lookup("users/card", "app/views/posts/index.html.erb")?.file).toBe("app/views/users/_card.html.erb")
    expect(index.lookup("users/card", "app/views/posts/index.html.erb")?.locals).toEqual([{ name: "user", required: true }])
  })

  test("falls back to a variant when there is no base template", async () => {
    const root = project({
      "app/views/users/_card.html+phone.erb": `<%# locals: (user:) %>\n`,
      "app/views/users/_card.en.html.erb": `<%# locals: (user:) %>\n`,
    })

    const index = await buildPartialIndex(Herb, root)

    expect(index.size).toBe(1)
    expect(index.lookup("users/card", "app/views/posts/index.html.erb")?.file).toBe("app/views/users/_card.en.html.erb")
  })

  test("prefers html over turbo_stream when both are base templates", async () => {
    const root = project({
      "app/views/users/_card.turbo_stream.erb": `<%# locals: (turbo:) %>\n`,
      "app/views/users/_card.html.erb": `<%# locals: (user:) %>\n`,
    })

    const index = await buildPartialIndex(Herb, root)

    expect(index.lookup("users/card", "app/views/posts/index.html.erb")?.file).toBe("app/views/users/_card.html.erb")
  })

  test("indexes the partials of a Rails project", async () => {
    const root = project({
      "app/views/users/_card.html.erb": `<%# locals: (user:, size: "large") %>\n\n<%= user %>\n`,
      "app/views/application/_flash.html.erb": `<%# locals: (message:) %>\n\n<%= message %>\n`,
      "app/views/posts/index.html.erb": `<%= render "users/card", user: @user %>\n`,
    })

    const index = await buildPartialIndex(Herb, root)

    expect(index.viewRoot).toBe("app/views")
    expect(index.size).toBe(2)

    expect(index.lookup("users/card", "app/views/posts/index.html.erb")).toEqual({
      file: "app/views/users/_card.html.erb",
      hasDeclaration: true,
      hasKeywordRest: false,
      locals: [{ name: "user", required: true }, { name: "size", required: false }],
    })
  })

  test("does not index templates that are not partials", async () => {
    const root = project({
      "app/views/posts/index.html.erb": `<div></div>\n`,
      "app/views/posts/_row.html.erb": `<%# locals: (post:) %>\n\n<%= post %>\n`,
    })

    const index = await buildPartialIndex(Herb, root)

    expect(index.size).toBe(1)
    expect(index.lookup("posts/row", "app/views/posts/index.html.erb")).not.toBeNull()
  })

  test("indexes every partial extension", async () => {
    const root = project({
      "app/views/posts/_row.turbo_stream.erb": `<%# locals: (post:) %>\n`,
      "app/views/posts/_cell.herb": `<%# locals: (cell:) %>\n`,
    })

    const index = await buildPartialIndex(Herb, root)

    expect(index.size).toBe(2)
  })

  test("falls back to the project root when there is no app/views", async () => {
    const root = project({
      "views/_card.html.erb": `<%# locals: (user:) %>\n`,
    })

    const index = await buildPartialIndex(Herb, root)

    expect(index.viewRoot).toBe(".")
    expect(index.lookup("views/card", "index.html.erb")?.file).toBe("views/_card.html.erb")
  })

  test("records a partial without a declaration", async () => {
    const root = project({
      "app/views/posts/_row.html.erb": `<div>Row</div>\n`,
    })

    const index = await buildPartialIndex(Herb, root)

    expect(index.lookup("posts/row", "app/views/posts/index.html.erb")?.hasDeclaration).toBe(false)
  })

  test("returns an empty index for a project with no partials", async () => {
    const root = project({ "app/views/posts/index.html.erb": `<div></div>\n` })

    const index = await buildPartialIndex(Herb, root)

    expect(index.size).toBe(0)
  })
})

describe("findViewRoot", () => {
  test("prefers app/views when it holds partials", async () => {
    const root = project({ "app/views/users/_card.html.erb": `<%# locals: (user:) %>\n` })

    expect(await findViewRoot(root)).toBe("app/views")
  })

  test("falls back to the project root", async () => {
    const root = project({ "templates/_card.html.erb": `<%# locals: (user:) %>\n` })

    expect(await findViewRoot(root)).toBe(".")
  })
})
