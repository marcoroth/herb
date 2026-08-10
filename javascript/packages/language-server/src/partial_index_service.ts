import { relative } from "node:path"
import { fileURLToPath } from "node:url"

import { isPartialPath } from "@herb-tools/core"
import { buildPartialIndex, declarationFromFile, declarationFromSource } from "@herb-tools/linter/partial-index-builder"

import { Project } from "./project"

import type { Connection } from "vscode-languageserver/node"
import type { PartialIndex } from "@herb-tools/core"

export class PartialIndexService {
  private readonly connection: Connection
  private readonly project: Project
  private partials?: PartialIndex

  constructor(connection: Connection, project: Project) {
    this.connection = connection
    this.project = project
  }

  get index(): PartialIndex | undefined {
    return this.partials
  }

  async initialize(): Promise<void> {
    try {
      this.partials = await buildPartialIndex(this.project.herbBackend, this.project.projectPath)

      this.connection.console.log(`[Partials] Indexed ${this.partials.size} partials under ${this.partials.viewRoot}`)
    } catch (error) {
      this.connection.console.warn(`[Partials] Failed to index partials: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  relativePathFor(uri: string): string | null {
    if (!uri.startsWith("file://")) return null

    try {
      const path = relative(this.project.projectPath, fileURLToPath(uri))

      return path.startsWith("..") ? null : path
    } catch {
      return null
    }
  }

  updateFromSource(uri: string, source: string): boolean {
    const file = this.partialFileFor(uri)

    if (!this.partials || !file) return false

    return this.partials.update(declarationFromSource(this.project.herbBackend, file, source)) !== null
  }

  updateFromDisk(uri: string): boolean {
    const file = this.partialFileFor(uri)

    if (!this.partials || !file) return false

    const declaration = declarationFromFile(this.project.herbBackend, this.project.projectPath, file)

    if (!declaration) return false

    return this.partials.update(declaration) !== null
  }

  remove(uri: string): boolean {
    const file = this.partialFileFor(uri)

    if (!this.partials || !file) return false

    return this.partials.remove(file) !== null
  }

  private partialFileFor(uri: string): string | null {
    if (!isPartialPath(uri)) return null

    return this.relativePathFor(uri)
  }
}
