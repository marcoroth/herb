import type { InitializeParams, WorkspaceFoldersChangeEvent } from "vscode-languageserver/node"
import { pathFromUri } from "@herb-tools/language-service"

const FILE_SCHEME = "file://"

/**
 * The folders the client currently has open. These are the outer boundary the
 * server is willing to work in, not the unit it works on: a single folder can
 * hold several projects, which `Projects` resolves separately.
 */
export class WorkspaceFolders {
  private readonly params: InitializeParams
  private folders: string[]

  constructor(params: InitializeParams) {
    this.params = params

    const opened = params.workspaceFolders?.map(folder => folder.uri) ?? []

    this.folders = this.pathsOf(opened.length > 0 ? opened : [params.rootUri ?? params.rootPath ?? ""])
  }

  get paths(): string[] {
    return this.folders
  }

  get primary(): string {
    const uri = this.params.workspaceFolders?.at(0)?.uri ?? this.params.rootUri ?? this.params.rootPath ?? ""

    return uri.replace(/^file:\/\//, "")
  }

  update(event: WorkspaceFoldersChangeEvent) {
    const removed = new Set(this.pathsOf(event.removed.map(folder => folder.uri)))

    this.folders = [
      ...this.folders.filter(path => !removed.has(path)),
      ...this.pathsOf(event.added.map(folder => folder.uri)),
    ]
  }

  /**
   * Non-`file:` documents (untitled buffers, virtual filesystems) have nowhere to
   * live, so they are always in scope rather than being silently dropped.
   */
  includes(uri: string): boolean {
    if (!uri.startsWith(FILE_SCHEME)) return true
    if (this.folders.length === 0) return true

    return this.containsPath(pathFromUri(uri))
  }

  containsPath(path: string): boolean {
    return this.folders.some(root => path === root || path.startsWith(`${root}/`))
  }

  private pathsOf(uris: string[]): string[] {
    return uris.filter(uri => uri !== "").map(uri => pathFromUri(uri).replace(/\/$/, ""))
  }
}
