import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs"
import { dirname, join, relative, resolve } from "node:path"
import { glob } from "tinyglobby"

import { Location, deserializeDiagnostic } from "@herb-tools/core"
import { projectRelativePath } from "@herb-tools/analysis"

import type { SerializedDiagnostic } from "@herb-tools/core"
import type { AncestorChain, PartialIndex, RenderGraph } from "@herb-tools/analysis"
import type { LintOffense, LintResult } from "../types.js"
import type { Fixability } from "../fixability.js"
import type { ProcessedFile } from "./file-processor.js"

const CACHE_FORMAT = 1
const CACHE_FILENAME = "lint-cache.json"

export interface CachedOffense {
  offense: SerializedDiagnostic & { rule: string }
  renderedFrom?: AncestorChain
  autocorrectable: boolean
  unsafeAutocorrectable: boolean
}

export interface CachedFileResult {
  offenses: CachedOffense[]
  ignored: number
  wouldBeIgnored: number
  counterSuppressed: number
}

interface CacheEntry extends CachedFileResult {
  key: string
}

interface CacheFile {
  format: number
  key: string
  files: Record<string, CacheEntry>
}

export interface LintCacheInputs {
  projectPath: string
  linterVersion: string
  herbVersion: string
  config: unknown
  configVersion?: string
  /** Where the config sits relative to the project, since its `include` and `exclude` patterns resolve from there. */
  configDirectory?: string
  only?: string[]
  allRules?: boolean
  ignoreDisableComments?: boolean
  customRuleFiles: string[]
  partials?: PartialIndex
  partialCallers?: RenderGraph
}

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex")
}

export function resolveCacheLocation(projectPath: string, cacheLocation?: string): string {
  if (cacheLocation) {
    const location = resolve(cacheLocation)
    const isDirectory = /[\\/]$/.test(cacheLocation) || (existsSync(location) && statSync(location).isDirectory())

    return isDirectory ? join(location, CACHE_FILENAME) : location
  }

  if (existsSync(join(projectPath, "node_modules"))) {
    return join(projectPath, "node_modules", ".cache", "herb-lint", CACHE_FILENAME)
  }

  return join(projectPath, "tmp", "cache", "herb-lint", CACHE_FILENAME)
}

/**
 * Every file under `.herb/rules`, hidden ones included, not only the rule entry points, so a
 * helper or settings file a rule reads from there also invalidates the cache.
 */
export async function customRuleFiles(projectPath: string): Promise<string[]> {
  const files = await glob(".herb/rules/**/*", { cwd: projectPath, absolute: true, onlyFiles: true, dot: true })

  return files.sort()
}

/**
 * Built from the plain lint result even under `--fix`, since the fixer's list of unfixed
 * offenses leaves out what lexer rules report.
 */
export function cachedFileResultFrom(lintResult: LintResult, fixabilityOf: (offense: LintOffense) => Fixability): CachedFileResult {
  return {
    offenses: lintResult.offenses.map(offense => ({
      offense: serializeOffense(offense),
      renderedFrom: offense.renderedFrom,
      ...fixabilityOf(offense)
    })),
    ignored: lintResult.ignored,
    wouldBeIgnored: lintResult.wouldBeIgnored ?? 0,
    counterSuppressed: lintResult.counterSuppressed ?? 0
  }
}

/**
 * Custom rules may report a plain `{ start, end }` object instead of a `Location`.
 */
function serializeOffense(offense: LintOffense): CachedOffense["offense"] {
  return {
    message: offense.message,
    location: Location.from(offense.location).toJSON(),
    severity: offense.severity,
    code: offense.code,
    source: offense.source,
    tags: offense.tags,
    rule: offense.rule
  }
}

/**
 * Remembers each file's lint result across runs, keyed by everything that can change it.
 *
 * A file's offenses depend on more than its own content: rules read the partial index to check
 * render calls against a partial's `locals`, and read the render graph to judge a partial by where
 * its callers place it. The whole partial index goes into the run key, since a partial's
 * declaration rarely changes. The render graph changes with any line moved in any caller, so each
 * file's key covers only its own slice of it, the `contextOf` and `inferSignature` answers that
 * built-in rules ask for. A rule that reads anything else from the graph must be added to
 * `graphSliceOf`, or its results go stale. Custom rules can read any of it, so loading them puts
 * the whole graph into the run key instead.
 */
export class LintCache {
  readonly path: string
  private projectPath: string
  private key: string
  private files: Record<string, CacheEntry>
  private partialCallers?: RenderGraph
  private sliceGraph: boolean

  private constructor(path: string, projectPath: string, key: string, files: Record<string, CacheEntry>, partialCallers: RenderGraph | undefined, sliceGraph: boolean) {
    this.path = path
    this.projectPath = projectPath
    this.key = key
    this.files = files
    this.partialCallers = partialCallers
    this.sliceGraph = sliceGraph
  }

  static open(path: string, inputs: LintCacheInputs): LintCache {
    const sliceGraph = inputs.customRuleFiles.length === 0

    const key = digest(JSON.stringify({
      format: CACHE_FORMAT,
      linterVersion: inputs.linterVersion,
      herbVersion: inputs.herbVersion,
      config: inputs.config,
      configVersion: inputs.configVersion,
      configDirectory: inputs.configDirectory,
      only: inputs.only,
      allRules: inputs.allRules ?? false,
      ignoreDisableComments: inputs.ignoreDisableComments ?? false,
      customRules: inputs.customRuleFiles.map(file => [relative(inputs.projectPath, file), digest(readFileSync(file, "utf-8"))]),
      partials: inputs.partials?.toJSON(),
      partialCallers: sliceGraph ? undefined : inputs.partialCallers?.toJSON()
    }))

    const stored = LintCache.read(path)
    const files = stored?.format === CACHE_FORMAT && stored.key === key ? stored.files : {}

    return new LintCache(path, inputs.projectPath, key, files, inputs.partialCallers, sliceGraph)
  }

  /**
   * A cache file that doesn't parse or has no `files` object, such as one edited by hand, is
   * treated as empty and rewritten on save: losing the cache only costs a full lint, so it
   * never fails the run.
   */
  private static read(path: string): CacheFile | undefined {
    if (!existsSync(path)) return undefined

    let stored: CacheFile

    try {
      stored = JSON.parse(readFileSync(path, "utf-8"))
    } catch {
      return undefined
    }

    const files = stored?.files

    return typeof files === "object" && files !== null && !Array.isArray(files) ? stored : undefined
  }

  keyFor(filename: string, content: string): string {
    return digest(content + "\0" + this.graphSliceOf(filename))
  }

  /**
   * Asks the graph under both names a rule may use: rules resolve the file to its project-relative
   * path, while `erb-strict-locals-required` passes the file name it was given.
   */
  private graphSliceOf(filename: string): string {
    if (!this.sliceGraph || !this.partialCallers) return ""

    const names = [...new Set([projectRelativePath(filename, this.projectPath), filename])]

    return JSON.stringify(names.map(name => ({
      context: this.partialCallers!.contextOf(name),
      signature: this.partialCallers!.inferSignature(name)
    })))
  }

  get(filename: string, key: string): CachedFileResult | undefined {
    const entry = this.files[this.entryName(filename)]

    return entry?.key === key ? entry : undefined
  }

  set(filename: string, key: string, result: CachedFileResult): void {
    this.files[this.entryName(filename)] = { key, ...result }
  }

  /**
   * Files arrive absolute or relative depending on how herb-lint was invoked. Storing them
   * relative to the project keeps a cache restored into a checkout at another path usable.
   */
  private entryName(filename: string): string {
    return relative(this.projectPath, resolve(this.projectPath, filename))
  }

  /**
   * The rename keeps a concurrent reader from seeing a half-written file.
   */
  save(): void {
    const files: Record<string, CacheEntry> = {}

    for (const [filename, entry] of Object.entries(this.files)) {
      if (existsSync(resolve(this.projectPath, filename))) files[filename] = entry
    }

    const contents: CacheFile = { format: CACHE_FORMAT, key: this.key, files }
    const temporaryPath = `${this.path}.${process.pid}.tmp`

    try {
      mkdirSync(dirname(this.path), { recursive: true })
      writeFileSync(temporaryPath, JSON.stringify(contents), "utf-8")
      renameSync(temporaryPath, this.path)
    } catch (error) {
      if (existsSync(temporaryPath)) rmSync(temporaryPath)
      console.warn(`Warning: Could not write the lint cache to ${this.path}: ${error instanceof Error ? error.message : error}`)
    }
  }
}

export function processedFilesFrom(filename: string, result: CachedFileResult): ProcessedFile[] {
  return result.offenses.map(cached => ({
    filename,
    offense: deserializeDiagnostic(cached.offense),
    renderedFrom: cached.renderedFrom,
    autocorrectable: cached.autocorrectable,
    unsafeAutocorrectable: cached.unsafeAutocorrectable
  }))
}
