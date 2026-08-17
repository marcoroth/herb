import { describe, test, expect } from "vitest"
import { posix } from "node:path"

import { basename, dirname, join, relative } from "../src/posix_path"

const PATHS = [
  "/app/views/posts/index.html.erb",
  "/app/views/posts/_card.html.erb",
  "/app/views",
  "/app",
  "/",
  "index.html.erb",
  "/app/views/admin/posts/_row.html.erb",
]

describe("posix_path", () => {
  describe("basename", () => {
    test.each(PATHS)("matches node for %s", path => {
      expect(basename(path)).toBe(posix.basename(path))
    })
  })

  describe("dirname", () => {
    test.each(PATHS)("matches node for %s", path => {
      expect(dirname(path)).toBe(posix.dirname(path))
    })
  })

  describe("join", () => {
    const cases: string[][] = [
      ["/app/views", "posts", "_card.html.erb"],
      ["/app/views/posts", "..", "shared", "_meta.html.erb"],
      ["/app", "views"],
      ["app", "views"],
      ["/app/views/", "/posts/"],
      ["/app/views", "."],
    ]

    test.each(cases)("matches node for %s", (...parts) => {
      expect(join(...parts)).toBe(posix.join(...parts))
    })
  })

  describe("relative", () => {
    const cases: [string, string][] = [
      ["/app/views", "/app/views/posts/_card.html.erb"],
      ["/app/views/posts", "/app/views/shared/_meta.html.erb"],
      ["/app/views", "/app/views"],
      ["/app/views/posts", "/app"],
      ["/app", "/app/views/admin/posts/_row.html.erb"],
    ]

    test.each(cases)("matches node for %s -> %s", (from, to) => {
      expect(relative(from, to)).toBe(posix.relative(from, to))
    })
  })
})
