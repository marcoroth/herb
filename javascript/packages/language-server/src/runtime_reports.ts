import { join } from "node:path"
import { createHash } from "node:crypto"
import { readFileSync, statSync, watch, type FSWatcher } from "node:fs"

import { InlayHint, InlayHintKind, MarkupKind, Position, Range } from "vscode-languageserver/node"

const SHORT_LENGTH = 8
const RECORD_VERSION = 1

const DEFAULT_ROOT = join("tmp", "herb")
const JOURNAL_DIRECTORY = "journal"
const EXTENSION = ".jsonl"

const MAX_TOOLTIP_OBSERVATIONS = 12
const WRAPPING_OBSERVATION = 80
const MAX_RECENT = 5
const REFRESH_DEBOUNCE = 200
const ATTACH_RETRY = 5_000

export function templateDigest(source: string): string {
  const text = source.startsWith("﻿") ? source.slice(1) : source

  return createHash("sha256").update(Buffer.from(text, "utf8")).digest("hex")
}

export function shortDigest(digest: string): string {
  return digest.slice(0, SHORT_LENGTH)
}

interface FindingRecord {
  v: number
  t: string
  at?: string
  run?: string
  request_path?: string
  node?: string
  line?: number
  column?: number
  end_line?: number
  end_column?: number
  code?: string
  origin?: string
  kind?: string
  severity?: string
  message?: string
  description?: string
  value?: string
  data?: Record<string, unknown>
  data_trimmed?: boolean
  dropped?: number
  digest?: string
  path?: string
  first_seen?: string
}

export interface RuntimeFinding {
  line: number
  column: number
  endLine: number
  endColumn: number
  code: string | null
  origin: string | null
  kind: string | null
  value: string
  message: string
  peakMessage: string
  description: string | null
  count: number
  values: Record<string, number>
  range: { min: number; max: number } | null
  observations: Record<string, unknown>
  observationsTrimmed: boolean
  recent: { value: string; at: string | null }[]
  firstSeen: string | null
  lastSeen: string | null
  runs: string[]
}

export interface RuntimeOverlay {
  range: Range
  text: string
  code: string | null
  origin: string | null
  recent: { value: string; at: string | null }[]
}

interface CallRecord {
  v: number
  t: string
  at?: string
  run?: string
  request_path?: string
  line?: number
  column?: number
  via?: string
  targets?: Record<string, number>
  parents?: number
  renders?: number
  per_parent?: Record<string, number>
}

export interface RuntimeCall {
  line: number
  column: number
  via: string | null
  targets: Record<string, number>
  perParent: Record<number, number>
  peak: number
  onlyTarget: string | null
  parents: number
  renders: number
  observed: number
  paths: Record<string, number>
}

export interface RuntimeShard {
  template: string
  digest: string
  findings: RuntimeFinding[]
  calls: RuntimeCall[]
  dropped: number
  firstSeen: string | null
}

interface CacheEntry {
  key: string
  shard: RuntimeShard | null
}

/**
 * What the renderer saw, for the file the editor has open.
 *
 * The editor hashes its buffer, which produces the name of a file the renderer
 * may or may not have written. That it exists is the whole staleness check. A
 * buffer edited since the render hashes to a name that is not there, so a
 * position recorded against text that no longer exists is never shown, and
 * nothing has to work out how far an edit moved things.
 *
 * What comes back is folded across every request that touched the template,
 * which is the part a single request cannot say. One page load reports three
 * queries at a tag. The shard reports three to forty seven across two hundred
 * renders, and that is the difference between a number and an N+1.
 */
export class RuntimeReports {
  private readonly root: string
  private readonly cache: Map<string, CacheEntry> = new Map()

  private watcher: FSWatcher | null = null
  private retry: NodeJS.Timeout | null = null
  private debounce: NodeJS.Timeout | null = null

  constructor(projectRoot: string, storeRoot: string = DEFAULT_ROOT) {
    this.root = join(projectRoot, storeRoot)
  }

  inlayHintsFor(relativePath: string | null, source: string, includeValues = false): InlayHint[] {
    const shard = this.shardFor(relativePath, source)

    if (!shard) return []

    const lines = source.split("\n")

    return shard.findings.filter(finding => includeValues || !this.overlays(finding)).map(finding => this.hint(finding, lines))
  }

  overlaysFor(relativePath: string | null, source: string): RuntimeOverlay[] {
    const shard = this.shardFor(relativePath, source)

    if (!shard) return []

    return shard.findings.filter(finding => this.overlays(finding)).map(finding => ({
      range: Range.create(
        Position.create(Math.max(finding.line - 1, 0), Math.max(finding.column - 1, 0)),
        Position.create(Math.max(finding.endLine - 1, 0), Math.max(finding.endColumn - 1, 0)),
      ),
      text: finding.value,
      code: finding.code,
      origin: finding.origin,
      recent: finding.recent,
    }))
  }

  private overlays(finding: RuntimeFinding): boolean {
    return finding.kind === "value"
  }

  shardFor(relativePath: string | null, source: string): RuntimeShard | null {
    if (!relativePath) return null

    const digest = templateDigest(source)

    return this.read(this.shardPath(relativePath, digest), relativePath, digest)
  }

  shardPath(relativePath: string, digest: string): string {
    return join(this.root, JOURNAL_DIRECTORY, `${relativePath}.${shortDigest(digest)}${EXTENSION}`)
  }

  watch(onChange: () => void): void {
    if (this.watcher) return

    try {
      this.watcher = watch(join(this.root, JOURNAL_DIRECTORY), { recursive: true }, () => {
        this.cache.clear()

        if (this.debounce) clearTimeout(this.debounce)

        this.debounce = setTimeout(onChange, REFRESH_DEBOUNCE)
      })

      this.watcher.on("error", () => this.reattach(onChange))

      if (this.retry) {
        clearTimeout(this.retry)
        this.retry = null
      }
    } catch {
      this.reattach(onChange)
    }
  }

  dispose(): void {
    this.watcher?.close()
    this.watcher = null

    if (this.retry) clearTimeout(this.retry)
    if (this.debounce) clearTimeout(this.debounce)

    this.retry = null
    this.debounce = null
  }

  private reattach(onChange: () => void): void {
    this.watcher?.close()
    this.watcher = null

    if (this.retry) return

    this.retry = setTimeout(() => {
      this.retry = null

      this.watch(onChange)
    }, ATTACH_RETRY)

    this.retry.unref?.()
  }

  private read(path: string, template: string, digest: string): RuntimeShard | null {
    let key: string

    try {
      const stats = statSync(path)

      key = `${stats.mtimeMs}:${stats.size}`
    } catch {
      this.cache.delete(path)

      return null
    }

    const cached = this.cache.get(path)

    if (cached && cached.key === key) {
      return cached.shard
    }

    const shard = this.parse(path, template, digest)

    this.cache.set(path, { key, shard })

    return shard
  }

  private parse(path: string, template: string, digest: string): RuntimeShard | null {
    let contents: string

    try {
      contents = readFileSync(path, "utf8")
    } catch {
      return null
    }

    const records = this.records(contents)
    const header = records.find(record => record.t === "template")
    const findings = records.filter(record => record.t === "finding")
    const dropped = records.filter(record => record.t === "truncated").reduce((total, record) => total + (record.dropped ?? 0), 0)

    return {
      template,
      digest: header?.digest ?? digest,
      findings: this.fold(findings),
      calls: this.foldCalls(records.filter(record => record.t === "call") as unknown as CallRecord[]),
      dropped,
      firstSeen: header?.first_seen ?? null,
    }
  }

  private records(contents: string): FindingRecord[] {
    const records: FindingRecord[] = []

    for (const line of contents.split("\n")) {
      if (line.trim() === "") continue

      try {
        const record = JSON.parse(line)

        if (record && typeof record === "object" && record.v === RECORD_VERSION) {
          records.push(record as FindingRecord)
        }
      } catch {
        continue
      }
    }

    return records
  }

  callsFor(relativePath: string | null, source: string): RuntimeCall[] {
    return this.shardFor(relativePath, source)?.calls ?? []
  }

  private foldCalls(records: CallRecord[]): RuntimeCall[] {
    const groups = new Map<string, CallRecord[]>()

    for (const record of records) {
      const key = `${record.line}:${record.column}`
      const group = groups.get(key)

      if (group) {
        group.push(record)
      } else {
        groups.set(key, [record])
      }
    }

    return [...groups.values()].map(group => this.call(group)).sort((a, b) => a.line - b.line || a.column - b.column)
  }

  private call(group: CallRecord[]): RuntimeCall {
    const latest = group.reduce((newest, record) => ((record.at ?? "") >= (newest.at ?? "") ? record : newest), group[0])
    const targets = this.mergeCounts(group.map(record => record.targets))
    const perParent: Record<number, number> = {}

    for (const [count, parents] of Object.entries(this.mergeCounts(group.map(record => record.per_parent)))) {
      perParent[Number(count)] = parents
    }

    const names = Object.keys(targets)

    return {
      line: latest.line ?? 1,
      column: latest.column ?? 1,
      via: latest.via ?? null,
      targets,
      perParent,
      peak: Math.max(0, ...Object.keys(perParent).map(Number)),
      onlyTarget: names.length === 1 ? names[0] : null,
      parents: group.reduce((total, record) => total + (record.parents ?? 0), 0),
      renders: group.reduce((total, record) => total + (record.renders ?? 0), 0),
      observed: group.length,
      paths: this.tally(group.map(record => record.request_path)),
    }
  }

  private mergeCounts(counts: (Record<string, number> | undefined)[]): Record<string, number> {
    const merged: Record<string, number> = {}

    for (const tally of counts) {
      if (!tally) continue

      for (const [key, count] of Object.entries(tally)) {
        merged[key] = (merged[key] ?? 0) + count
      }
    }

    return merged
  }

  private tally(values: (string | undefined)[]): Record<string, number> {
    const counted: Record<string, number> = {}

    for (const value of values) {
      if (value === undefined) {
        continue
      }

      counted[value] = (counted[value] ?? 0) + 1
    }

    return counted
  }

  private fold(records: FindingRecord[]): RuntimeFinding[] {
    const groups = new Map<string, FindingRecord[]>()

    for (const record of records) {
      const key = `${record.line}:${record.column}:${record.code ?? record.message}`
      const group = groups.get(key)

      if (group) {
        group.push(record)
      } else {
        groups.set(key, [record])
      }
    }

    const findings = [...groups.values()].map(group => this.finding(group))

    return findings.sort((a, b) => a.line - b.line || a.column - b.column || (a.code ?? "").localeCompare(b.code ?? ""))
  }

  private recent(group: FindingRecord[]): { value: string; at: string | null }[] {
    const ordered = [...group].sort((a, b) => (a.at ?? "").localeCompare(b.at ?? "")).reverse()
    const history: { value: string; at: string | null }[] = []

    for (const record of ordered) {
      const observed = record.data?.output

      const values = Array.isArray(observed) && observed.length > 0
        ? [...observed].reverse().map(entry => String(entry))
        : [record.value ?? record.message].filter((entry): entry is string => entry !== undefined)

      for (const value of values) {
        if (history.length >= MAX_RECENT) {
          return history
        }

        history.push({ value, at: record.at ?? null })
      }
    }

    return history
  }

  private finding(group: FindingRecord[]): RuntimeFinding {
    const latest = group.reduce((newest, record) => ((record.at ?? "") >= (newest.at ?? "") ? record : newest), group[0])
    const peak = group.reduce((worst, record) => (this.leading(record.value) > this.leading(worst.value) ? record : worst), group[0])
    const values = group.map(record => record.value).filter((value): value is string => value !== undefined)
    const seen = group.map(record => record.at).filter((at): at is string => at !== undefined).sort()

    const tally: Record<string, number> = {}

    for (const value of values) {
      tally[value] = (tally[value] ?? 0) + 1
    }

    return {
      line: latest.line ?? 1,
      column: latest.column ?? 1,
      endLine: latest.end_line ?? latest.line ?? 1,
      endColumn: latest.end_column ?? latest.column ?? 1,
      code: latest.code ?? null,
      origin: latest.origin ?? null,
      kind: latest.kind ?? null,
      value: latest.value ?? latest.message ?? "",
      message: latest.message ?? "",
      peakMessage: peak.message ?? latest.message ?? "",
      description: peak.description ?? latest.description ?? null,
      count: group.length,
      values: tally,
      range: this.range(values),
      observations: peak.data ?? {},
      observationsTrimmed: peak.data_trimmed === true,
      recent: this.recent(group),
      firstSeen: seen[0] ?? null,
      lastSeen: seen[seen.length - 1] ?? null,
      runs: [...new Set(group.map(record => record.run).filter((run): run is string => run !== undefined))].slice(-5),
    }
  }

  private range(values: string[]): { min: number; max: number } | null {
    if (values.length === 0) return null

    const numbers: number[] = []

    for (const value of values) {
      const match = /^\s*(-?\d+(?:\.\d+)?)/.exec(value)

      if (!match) return null

      numbers.push(Number(match[1]))
    }

    return { min: Math.min(...numbers), max: Math.max(...numbers) }
  }

  private leading(value: string | undefined): number {
    const match = /^\s*(-?\d+(?:\.\d+)?)/.exec(value ?? "")

    return match ? Number(match[1]) : Number.NEGATIVE_INFINITY
  }

  private hint(finding: RuntimeFinding, lines: string[]): InlayHint {
    const single = finding.endLine === finding.line
    const line = single ? finding.endLine : finding.line
    const column = single ? finding.endColumn - 1 : (lines[finding.line - 1]?.length ?? finding.endColumn - 1)

    return {
      position: Position.create(Math.max(line - 1, 0), Math.max(column, 0)),
      label: this.label(finding),
      kind: InlayHintKind.Parameter,
      paddingLeft: true,
      tooltip: {
        kind: MarkupKind.Markdown,
        value: this.tooltip(finding),
      },
    }
  }

  private label(finding: RuntimeFinding): string {
    const phrase = finding.range && finding.range.min !== finding.range.max
      ? finding.peakMessage.replace(/^\s*-?\d+(?:\.\d+)?/, `${finding.range.min} to ${finding.range.max}`)
      : finding.peakMessage

    return `(${phrase})`
  }

  private tooltip(finding: RuntimeFinding): string {
    const lines: string[] = [`**${finding.peakMessage}**`, ""]

    if (finding.description) {
      lines.push(finding.description, "")
    }

    const spread = finding.range && finding.range.min !== finding.range.max
      ? `${finding.range.min} to ${finding.range.max} across ${finding.count} ${finding.count === 1 ? "render" : "renders"}`
      : `across ${finding.count} ${finding.count === 1 ? "render" : "renders"}`

    lines.push(spread, "")

    for (const [key, observed] of Object.entries(finding.observations)) {
      if (!Array.isArray(observed) || observed.length === 0) {
        continue
      }

      const shown = observed.slice(0, MAX_TOOLTIP_OBSERVATIONS)

      lines.push(`**${key}**`, "")
      lines.push(key === "queries" ? "```sql" : "```")
      lines.push(...this.spaced(shown.map(entry => this.observation(entry))))
      lines.push("```")

      if (finding.observationsTrimmed || observed.length > shown.length) {
        lines.push("", `showing ${shown.length} of them`)
      }

      lines.push("")
    }

    if (new Set(finding.recent.map(entry => entry.value)).size > 1) {
      lines.push(`**Last ${finding.recent.length} renders**`, "")
      lines.push(...finding.recent.map(entry => `- ${this.oneLine(entry.value)}`))
      lines.push("")
    }

    if (finding.origin) {
      lines.push(`recorded by ${finding.origin}`)
    }

    return lines.join("\n")
  }

  private spaced(entries: string[]): string[] {
    if (!entries.some(entry => entry.length > WRAPPING_OBSERVATION)) {
      return entries
    }

    return entries.flatMap((entry, index) => index === 0 ? [entry] : ["", entry])
  }

  private observation(entry: unknown): string {
    if (entry === null || typeof entry !== "object") {
      return String(entry)
    }

    return Object.entries(entry as Record<string, unknown>).map(([key, value]) => `${key}: ${value}`).join("  ")
  }

  private oneLine(value: string): string {
    const flattened = value.replace(/\s+/g, " ").trim()

    if (flattened === "") {
      return "_(empty)_"
    }

    return flattened.length > 80 ? `${flattened.slice(0, 80)}…` : flattened
  }
}
