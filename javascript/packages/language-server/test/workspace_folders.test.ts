import { describe, test, expect } from "vitest"

import { WorkspaceFolders } from "../src/workspace_folders"

import type { InitializeParams } from "vscode-languageserver/node"

describe("WorkspaceFolders", () => {
  const mockParams: InitializeParams = {
    processId: null,
    rootUri: null,
    capabilities: {},
    workspaceFolders: null
  }

  function foldersFor(folders: string[] | null, rootUri: string | null = null): WorkspaceFolders {
    return new WorkspaceFolders({
      ...mockParams,
      rootUri,
      workspaceFolders: folders?.map(uri => ({ uri, name: uri })) ?? null,
    })
  }

  describe("includes", () => {
    test("accepts a document inside the only folder", () => {
      expect(foldersFor(["file:///work/foo"]).includes("file:///work/foo/app/views/a.html.erb")).toBe(true)
    })

    test("accepts a document inside any folder", () => {
      const folders = foldersFor(["file:///work/foo", "file:///work/bar"])

      expect(folders.includes("file:///work/bar/app/views/a.html.erb")).toBe(true)
    })

    test("rejects a document saved outside every folder", () => {
      expect(foldersFor(["file:///work/foo"]).includes("file:///work/bar/example.html")).toBe(false)
    })

    test("rejects a sibling folder that merely shares a prefix", () => {
      expect(foldersFor(["file:///work/foo"]).includes("file:///work/foobar/example.html")).toBe(false)
    })

    test("accepts the folder itself", () => {
      expect(foldersFor(["file:///work/foo"]).includes("file:///work/foo")).toBe(true)
    })

    test("falls back to rootUri when no folders are given", () => {
      const folders = foldersFor(null, "file:///work/foo")

      expect(folders.includes("file:///work/foo/a.html.erb")).toBe(true)
      expect(folders.includes("file:///work/bar/a.html.erb")).toBe(false)
    })

    test("accepts everything when the client opened no folder at all", () => {
      expect(foldersFor(null).includes("file:///anywhere/a.html.erb")).toBe(true)
    })

    test("accepts an untitled buffer, which has nowhere to live", () => {
      expect(foldersFor(["file:///work/foo"]).includes("untitled:Untitled-1")).toBe(true)
    })

    test("accepts a document served by a virtual filesystem", () => {
      expect(foldersFor(["file:///work/foo"]).includes("vscode-vfs://github/marcoroth/herb/a.html.erb")).toBe(true)
    })

    test("handles a percent encoded path", () => {
      expect(foldersFor(["file:///work/my%20app"]).includes("file:///work/my%20app/a.html.erb")).toBe(true)
    })
  })

  describe("update", () => {
    test("drops a folder the client closed", () => {
      const folders = foldersFor(["file:///work/foo", "file:///work/bar"])

      folders.update({ added: [], removed: [{ uri: "file:///work/bar", name: "bar" }] })

      expect(folders.paths).toEqual(["/work/foo"])
      expect(folders.includes("file:///work/bar/a.html.erb")).toBe(false)
    })

    test("takes in a folder the client opened", () => {
      const folders = foldersFor(["file:///work/foo"])

      folders.update({ added: [{ uri: "file:///work/bar", name: "bar" }], removed: [] })

      expect(folders.includes("file:///work/bar/a.html.erb")).toBe(true)
    })
  })
})
