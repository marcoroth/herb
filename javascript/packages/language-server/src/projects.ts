import { dirname } from "node:path"

import { Config } from "@herb-tools/config"
import { Project } from "./project"

import type { Connection } from "vscode-languageserver/node"
import type { WorkspaceFolders } from "./workspace_folders"
import type { SharedServices } from "./project"
import { pathFromUri } from "@herb-tools/language-service"

const FILE_SCHEME = "file://"

/**
 * Herb resolves a project by walking up for a `.herb.yml`, so a project
 * folder is a boundary rather than a unit. One folder can hold several projects
 * and each of them gets its own config, linter and partial index, keyed by the
 * root that `Config` itself would pick for a file.
 */
export class Projects {
  private readonly connection: Connection
  private readonly workspaceFolders: WorkspaceFolders
  private readonly shared: SharedServices

  private readonly byRoot: Map<string, Project> = new Map()
  private readonly initializing: Map<string, Promise<Project>> = new Map()
  private readonly rootByDirectory: Map<string, string> = new Map()

  constructor(connection: Connection, workspaceFolders: WorkspaceFolders, shared: SharedServices) {
    this.connection = connection
    this.workspaceFolders = workspaceFolders
    this.shared = shared
  }

  all(): Project[] {
    return [...this.byRoot.values()]
  }

  get(uri: string): Project | null {
    const root = this.rootFor(uri)

    return root === null ? null : this.byRoot.get(root) ?? null
  }

  async ensure(uri: string): Promise<Project | null> {
    const root = this.rootFor(uri)
    if (root === null) return null

    const pending = this.initializing.get(root)
    if (pending) return pending

    const existing = this.byRoot.get(root)
    if (existing) return existing

    const project = new Project(this.connection, root, this.shared)

    this.byRoot.set(root, project)

    const initialized = project.initialize().then(() => {
      this.connection.console.log(`[Project] Indexed ${root}`)

      return project
    }).finally(() => {
      this.initializing.delete(root)
    })

    this.initializing.set(root, initialized)

    return initialized
  }

  containing(path: string): Project | null {
    let best: Project | null = null

    for (const project of this.byRoot.values()) {
      if (!project.contains(path)) {
        continue
      }

      if (best === null || project.root.length > best.root.length) {
        best = project
      }
    }

    return best
  }

  prune(): string[] {
    const dropped = this.all().filter(project => !this.workspaceFolders.containsPath(project.root))

    for (const project of dropped) {
      this.remove(project.root)
    }

    this.forget()

    return dropped.map(project => project.root)
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
    if (!this.workspaceFolders.includes(uri)) return null

    const directory = dirname(pathFromUri(uri))

    const cached = this.rootByDirectory.get(directory)
    if (cached !== undefined) return cached

    const root = Config.findProjectRootSync(directory)

    this.rootByDirectory.set(directory, root)

    return root
  }
}
