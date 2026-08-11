import { join } from "node:path"
import { readFileSync } from "node:fs"

import { isTemplatePath } from "@herb-tools/analysis"
import { buildPartialCallerIndex, collectCallSites } from "@herb-tools/analysis/node"

import { PartialIndexService } from "./partial_index_service"
import { Project } from "./project"

import type { Connection } from "vscode-languageserver/node"
import type { PartialCallerIndex, PartialCallSite } from "@herb-tools/analysis"

export class PartialCallerIndexService {
  private readonly connection: Connection
  private readonly project: Project
  private readonly partials: PartialIndexService
  private callers?: PartialCallerIndex

  constructor(connection: Connection, project: Project, partials: PartialIndexService) {
    this.connection = connection
    this.project = project
    this.partials = partials
  }

  get index(): PartialCallerIndex | undefined {
    return this.callers
  }

  async initialize(): Promise<void> {
    const partials = this.partials.index

    if (!partials) {
      this.callers = undefined

      return
    }

    try {
      this.callers = await buildPartialCallerIndex(this.project.herbBackend, this.project.root, partials, { resolveLayouts: false })

      this.connection.console.log(`[Partials] Indexed call sites for ${this.callers.size} partials`)
    } catch (error) {
      this.connection.console.warn(`[Partials] Failed to index partial call sites: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  updateFromSource(uri: string, source: string): boolean {
    const file = this.templateFileFor(uri)

    if (!this.callers || !file) {
      return false
    }

    const sites = this.callSitesIn(file, source)
    if (!sites) return false

    return this.callers.replaceCallsFrom(file, sites)
  }

  updateFromDisk(uri: string): boolean {
    const file = this.templateFileFor(uri)

    if (!this.callers || !file) return false

    try {
      return this.updateFromSource(uri, readFileSync(join(this.project.root, file), "utf-8"))
    } catch {
      return false
    }
  }

  remove(uri: string): boolean {
    const file = this.templateFileFor(uri)

    if (!this.callers || !file) return false

    const stoppedCalling = this.callers.replaceCallsFrom(file, new Map())

    return this.callers.removeCallsTo(file) || stoppedCalling
  }

  private callSitesIn(file: string, source: string): Map<string, PartialCallSite[]> | null {
    const partials = this.partials.index
    if (!partials) return null

    const sites = new Map<string, PartialCallSite[]>()

    try {
      collectCallSites(this.project.herbBackend, partials, file, source, sites)
    } catch {
      return null
    }

    return sites
  }

  private templateFileFor(uri: string): string | null {
    if (!isTemplatePath(uri)) return null

    return this.partials.relativePathFor(uri)
  }
}
