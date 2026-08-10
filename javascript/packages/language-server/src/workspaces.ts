import { dirname } from "node:path"
import { pathFromUri } from "./utils"

import { Config } from "@herb-tools/config"
import { Workspace } from "./workspace"

import type { Connection } from "vscode-languageserver/node"
import type { Settings } from "./settings"
import type { SharedServices } from "./workspace"

const FILE_SCHEME = "file://"

/**
 * Herb resolves a project by walking up for a `.herb.yml`, so a workspace
 * folder is a boundary rather than a unit. One folder can hold several projects
 * and each of them gets its own config, linter and partial index, keyed by the
 * root that `Config` itself would pick for a file.
 */
export class Workspaces {
  private readonly connection: Connection
  private readonly settings: Settings
  private readonly shared: SharedServices

  private readonly byRoot: Map<string, Workspace> = new Map()
  private readonly initializing: Map<string, Promise<Workspace>> = new Map()
  private readonly rootByDirectory: Map<string, string> = new Map()

  constructor(connection: Connection, settings: Settings, shared: SharedServices) {
    this.connection = connection
    this.settings = settings
    this.shared = shared
  }

  all(): Workspace[] {
    return [...this.byRoot.values()]
  }

  get(uri: string): Workspace | null {
    const root = this.rootFor(uri)

    return root === null ? null : this.byRoot.get(root) ?? null
  }

  async ensure(uri: string): Promise<Workspace | null> {
    const root = this.rootFor(uri)
    if (root === null) return null

    const pending = this.initializing.get(root)
    if (pending) return pending

    const existing = this.byRoot.get(root)
    if (existing) return existing

    const workspace = new Workspace(this.connection, this.settings, root, this.shared)

    this.byRoot.set(root, workspace)

    const initialized = workspace.initialize().then(() => {
      this.connection.console.log(`[Workspace] Indexed ${root}`)

      return workspace
    }).finally(() => {
      this.initializing.delete(root)
    })

    this.initializing.set(root, initialized)

    return initialized
  }

  containing(path: string): Workspace | null {
    let best: Workspace | null = null

    for (const workspace of this.byRoot.values()) {
      if (!workspace.contains(path)) {
        continue
      }

      if (best === null || workspace.root.length > best.root.length) {
        best = workspace
      }
    }

    return best
  }

  prune(): string[] {
    const dropped = this.all().filter(workspace => !this.settings.containsPath(workspace.root))

    for (const workspace of dropped) {
      this.remove(workspace.root)
    }

    this.forget()

    return dropped.map(workspace => workspace.root)
  }

  remove(root: string): boolean {
    for (const [directory, cached] of this.rootByDirectory) {
      if (cached === root) this.rootByDirectory.delete(directory)
    }

    this.initializing.delete(root)

    return this.byRoot.delete(root)
  }

  forget() {
    this.rootByDirectory.clear()
  }

  private rootFor(uri: string): string | null {
    if (!uri.startsWith(FILE_SCHEME)) return null
    if (!this.settings.includes(uri)) return null

    const directory = dirname(pathFromUri(uri))

    const cached = this.rootByDirectory.get(directory)
    if (cached !== undefined) return cached

    const root = Config.findProjectRootSync(directory)

    this.rootByDirectory.set(directory, root)

    return root
  }
}
