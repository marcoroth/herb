import { join, relative } from "node:path"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import { isPartialPath, isTemplatePath } from "./partial-resolution"
import { buildPartialIndex, declarationFromFile, declarationFromSource } from "./partial-index-builder"
import { buildPartialCallerIndex, collectCallSites } from "./partial-caller-builder"

import type { HerbBackend } from "@herb-tools/core"
import type { PartialIndex } from "./partial-index"
import type { PartialCallerIndex, PartialCallSite } from "./partial-callers"

const FILE_SCHEME = "file://"

export interface AnalysisLogger {
  log(message: string): void
  warn(message: string): void
}

export interface ProjectIndexOptions {
  root: string
  backend: HerbBackend
  resolveLayouts?: boolean
  logger?: AnalysisLogger
}

/**
 * The front door to a project's analysis. It owns the indexes, which have to
 * be built in order because call sites are resolved against the declarations,
 * and keeps them in step as files change.
 *
 * Indexing a project reads from disk, which is why this lives behind the `node`
 * entry point rather than the browser-safe root.
 */
export class ProjectIndex {
  public readonly root: string

  private readonly backend: HerbBackend
  private readonly resolveLayouts: boolean
  private readonly logger?: AnalysisLogger

  private partialIndex?: PartialIndex
  private callerIndex?: PartialCallerIndex

  constructor({ root, backend, resolveLayouts = false, logger }: ProjectIndexOptions) {
    this.root = root
    this.backend = backend
    this.resolveLayouts = resolveLayouts
    this.logger = logger
  }

  get partials(): PartialIndex | undefined {
    return this.partialIndex
  }

  get callers(): PartialCallerIndex | undefined {
    return this.callerIndex
  }

  get viewRoot(): string | undefined {
    return this.partialIndex?.viewRoot
  }

  async indexAll(): Promise<void> {
    await this.indexPartials()
    await this.indexCallers()
  }

  async indexPartials(): Promise<void> {
    try {
      this.partialIndex = await buildPartialIndex(this.backend, this.root)

      this.logger?.log(`[Partials] Indexed ${this.partialIndex.size} partials under ${this.partialIndex.viewRoot}`)
    } catch (error) {
      this.logger?.warn(`[Partials] Failed to index partials: ${this.messageFor(error)}`)
    }
  }

  async indexCallers(): Promise<void> {
    if (!this.partialIndex) {
      this.callerIndex = undefined

      return
    }

    try {
      this.callerIndex = await buildPartialCallerIndex(this.backend, this.root, this.partialIndex, {
        resolveLayouts: this.resolveLayouts,
      })

      this.logger?.log(`[Partials] Indexed call sites for ${this.callerIndex.size} partials`)
    } catch (error) {
      this.logger?.warn(`[Partials] Failed to index partial call sites: ${this.messageFor(error)}`)
    }
  }

  handleChange(uri: string, source?: string): boolean {
    const declarationChanged = this.updatePartial(uri, source)
    const callsChanged = this.updateCallSites(uri, source)

    return declarationChanged || callsChanged
  }

  remove(uri: string): boolean {
    const stoppedCalling = this.removeCallSites(uri)

    return this.removePartial(uri) || stoppedCalling
  }

  relativePathFor(uri: string): string | null {
    if (!uri.startsWith(FILE_SCHEME)) return null

    try {
      const path = relative(this.root, fileURLToPath(uri))

      return path.startsWith("..") ? null : path
    } catch {
      return null
    }
  }

  private updatePartial(uri: string, source?: string): boolean {
    const file = this.partialFileFor(uri)

    if (!this.partialIndex || !file) return false

    const declaration = (source === undefined) ? declarationFromFile(this.backend, this.root, file) : declarationFromSource(this.backend, file, source)
    if (!declaration) return false

    return this.partialIndex.update(declaration) !== null
  }

  private updateCallSites(uri: string, source?: string): boolean {
    const file = this.templateFileFor(uri)

    if (!this.callerIndex || !file) return false

    const contents = source === undefined ? this.read(join(this.root, file)) : source
    if (contents === null) return false

    const sites = this.callSitesIn(file, contents)
    if (!sites) return false

    return this.callerIndex.replaceCallsFrom(file, sites)
  }

  private removePartial(uri: string): boolean {
    const file = this.partialFileFor(uri)

    if (!this.partialIndex || !file) {
      return false
    }

    return this.partialIndex.remove(file) !== null
  }

  private removeCallSites(uri: string): boolean {
    const file = this.templateFileFor(uri)

    if (!this.callerIndex || !file) {
      return false
    }

    const stoppedCalling = this.callerIndex.replaceCallsFrom(file, new Map())

    return this.callerIndex.removeCallsTo(file) || stoppedCalling
  }

  private callSitesIn(file: string, source: string): Map<string, PartialCallSite[]> | null {
    if (!this.partialIndex) return null

    const sites = new Map<string, PartialCallSite[]>()

    try {
      collectCallSites(this.backend, this.partialIndex, file, source, sites)
    } catch {
      return null
    }

    return sites
  }

  private read(path: string): string | null {
    try {
      return readFileSync(path, "utf-8")
    } catch {
      return null
    }
  }

  private partialFileFor(uri: string): string | null {
    return isPartialPath(uri) ? this.relativePathFor(uri) : null
  }

  private templateFileFor(uri: string): string | null {
    return isTemplatePath(uri) ? this.relativePathFor(uri) : null
  }

  private messageFor(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
  }
}
