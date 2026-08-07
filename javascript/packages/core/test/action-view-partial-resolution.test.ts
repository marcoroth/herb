import { describe, test, expect } from "vitest"

import {
  isPartialPath,
  partialNameForFile,
  resolvePartial,
} from "../src/action-view-partial-resolution.js"

import type { PartialPaths } from "../src/action-view-partial-resolution.js"

const VIEW_ROOT = "app/views"

function paths(files: string[]): PartialPaths {
  const index: PartialPaths = new Map()

  for (const file of files) {
    const name = partialNameForFile(file, VIEW_ROOT)

    if (name !== null && !index.has(name)) index.set(name, file)
  }

  return index
}

describe("@herb-tools/core", () => {
  describe("isPartialPath", () => {
    test("accepts every partial extension", () => {
      expect(isPartialPath("app/views/users/_card.html.erb")).toBe(true)
      expect(isPartialPath("app/views/users/_card.html.herb")).toBe(true)
      expect(isPartialPath("app/views/users/_card.erb")).toBe(true)
      expect(isPartialPath("app/views/users/_card.herb")).toBe(true)
      expect(isPartialPath("app/views/users/_card.turbo_stream.erb")).toBe(true)
      expect(isPartialPath("app/views/users/_card.turbo_stream.herb")).toBe(true)
    })

    test("rejects templates that are not partials", () => {
      expect(isPartialPath("app/views/users/show.html.erb")).toBe(false)
    })

    test("rejects unrelated extensions", () => {
      expect(isPartialPath("app/views/users/_card.html.haml")).toBe(false)
    })

    test("does not care where the file lives", () => {
      expect(isPartialPath("app/components/_card.html.erb")).toBe(true)
      expect(isPartialPath("_card.html.erb")).toBe(true)
    })

    test("normalizes backslash separators", () => {
      expect(isPartialPath("app\\views\\users\\_card.html.erb")).toBe(true)
    })
  })

  describe("partialNameForFile", () => {
    test("builds a name from the directory and the basename", () => {
      expect(partialNameForFile("app/views/users/_card.html.erb", VIEW_ROOT)).toBe("users/card")
    })

    test("builds a name for a partial at the view root", () => {
      expect(partialNameForFile("app/views/_card.html.erb", VIEW_ROOT)).toBe("card")
    })

    test("keeps nested directories in the name", () => {
      expect(partialNameForFile("app/views/admin/users/_card.html.erb", VIEW_ROOT)).toBe("admin/users/card")
    })

    test("strips every extension segment", () => {
      expect(partialNameForFile("app/views/users/_card.turbo_stream.erb", VIEW_ROOT)).toBe("users/card")
    })

    test("returns null for a template that is not a partial", () => {
      expect(partialNameForFile("app/views/users/show.html.erb", VIEW_ROOT)).toBeNull()
    })

    test("returns null for a file outside the view root", () => {
      expect(partialNameForFile("app/components/_card.html.erb", VIEW_ROOT)).toBeNull()
    })

    test("does not treat a sibling directory as inside the view root", () => {
      expect(partialNameForFile("app/views_old/users/_card.html.erb", VIEW_ROOT)).toBeNull()
    })

    test("ignores a trailing slash on the view root", () => {
      expect(partialNameForFile("app/views/users/_card.html.erb", "app/views/")).toBe("users/card")
    })

    test("normalizes backslash separators", () => {
      expect(partialNameForFile("app\\views\\users\\_card.html.erb", "app\\views")).toBe("users/card")
    })

    test("resolves against a project root view root", () => {
      expect(partialNameForFile("users/_card.html.erb", ".")).toBe("users/card")
    })
  })

  describe("resolvePartial", () => {
    const index = paths([
      "app/views/users/_card.html.erb",
      "app/views/users/_avatar.html.erb",
      "app/views/application/_flash.html.erb",
      "app/views/admin/users/_card.html.erb",
    ])

    test("resolves a fully qualified name", () => {
      expect(resolvePartial("users/card", "app/views/posts/index.html.erb", index, VIEW_ROOT)).toBe("app/views/users/_card.html.erb")
    })

    test("resolves a bare name against the rendering template's directory", () => {
      expect(resolvePartial("avatar", "app/views/users/show.html.erb", index, VIEW_ROOT)).toBe("app/views/users/_avatar.html.erb")
    })

    test("falls back to the application directory for a bare name", () => {
      expect(resolvePartial("flash", "app/views/posts/index.html.erb", index, VIEW_ROOT)).toBe("app/views/application/_flash.html.erb")
    })

    test("prefers the exact name over the relative one", () => {
      expect(resolvePartial("users/card", "app/views/admin/index.html.erb", index, VIEW_ROOT)).toBe("app/views/users/_card.html.erb")
    })

    test("resolves a qualified name relative to the rendering template's directory", () => {
      const nested = paths(["app/views/admin/users/_card.html.erb"])

      expect(resolvePartial("users/card", "app/views/admin/index.html.erb", nested, VIEW_ROOT)).toBe("app/views/admin/users/_card.html.erb")
    })

    test("does not fall back to the application directory for a qualified name", () => {
      expect(resolvePartial("users/flash", "app/views/posts/index.html.erb", index, VIEW_ROOT)).toBeNull()
    })

    test("returns null for an unknown partial", () => {
      expect(resolvePartial("users/missing", "app/views/posts/index.html.erb", index, VIEW_ROOT)).toBeNull()
    })

    test("resolves from a template at the view root", () => {
      expect(resolvePartial("flash", "app/views/index.html.erb", index, VIEW_ROOT)).toBe("app/views/application/_flash.html.erb")
    })

    test("resolves from a source file outside the view root", () => {
      expect(resolvePartial("users/card", "app/components/card_component.html.erb", index, VIEW_ROOT)).toBe("app/views/users/_card.html.erb")
    })

    test("resolves without a known source file", () => {
      expect(resolvePartial("users/card", "", index, VIEW_ROOT)).toBe("app/views/users/_card.html.erb")
    })
  })
})
