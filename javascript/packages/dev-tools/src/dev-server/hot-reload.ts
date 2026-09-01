import { refresh } from "./refresher"
import { rebindRegion } from "./rebind"
import { diffStateManifests } from "./manifest-diff"
import { rebuildRegion, stateOwnedIndices } from "./rebuild"
import { heldRuntime } from "./runtime-handle"

import type { Region, Runtime } from "@herb-tools/client"
import type { DiagnosticSink, ErrorMessage, HotReloadHandler, InvalidateMessage, SchemaMessage } from "./types"

export interface HotReloadOptions {
  runtime?: () => Runtime | null
  sink?: () => DiagnosticSink | null
  reload?: () => void
  graceMs?: number
}

interface PendingEntry {
  schema: SchemaMessage | null
  invalidate: InvalidateMessage | null
  timer: ReturnType<typeof setTimeout> | null
}

type Cause = "no-runtime" | "no-regions" | "no-slots" | "server-mode" | "standalone"

const DEBUG_ROOT_ATTRIBUTE = "data-herb-debug-file-relative-path"
const DEBUG_MODE_META = 'meta[name="herb-debug-mode"][content="true"]'
const CAPABILITY_ORIGIN = "Herb Dev Server"
const DEFAULT_GRACE_MS = 250
const REPEATED_RELOADS = 3

const CAPABILITY_MESSAGES: Record<Cause, string> = {
  "no-runtime": "Falling back to full page reloads. The Herb client runtime is not running on this page, so edits cannot be applied in place. Start the client Runtime (ReActionView: enable `config.slots`).",
  "no-regions": "This page has no slot regions, so edits reload the whole page. Enable `config.slots` (or add `<%# herb:slots %>` to a template) for partial reloads.",
  "no-slots": "This template is not compiled with slots, so edits to it reload the page. Add `<%# herb:slots client %>` (or set the project default) for partial reloads.",
  "server-mode": "This template renders its branches on the server, so branch changes reload the page. Switch it to `<%# herb:slots client %>` for full hot reload.",
  "standalone": "herb dev is running standalone. Schema push and compile diagnostics need the app connected, so edits resolve by fetching or reloading.",
}

export class HotReload implements HotReloadHandler {
  private options: HotReloadOptions
  private reported = new Set<Cause>()
  private pending = new Map<string, PendingEntry>()
  private reloadCounts = new Map<string, number>()

  constructor(options: HotReloadOptions = {}) {
    this.options = options
  }

  onSchema(message: SchemaMessage): void {
    const runtime = this.runtime()

    if (runtime && message.manifest) {
      runtime.slots.adoptManifests({ [`${message.manifest.file}:${message.manifest.version}`]: message.manifest }, { replace: true })
    }

    if (runtime && message.statics && message.version.to && typeof runtime.slots.holdStatics === "function") {
      runtime.slots.holdStatics({ file: message.file, version: message.version.to }, message.statics)
    }

    const entry = this.entry(message.file)

    entry.schema = message

    if (entry.invalidate && entry.invalidate.version === message.version.to) {
      this.settle(message.file)
    }
  }

  onInvalidate(message: InvalidateMessage): void {
    if (message.version === null) {
      this.note("standalone")
    }

    const entry = this.entry(message.file)

    entry.invalidate = message

    if (message.version === null || entry.schema?.version.to === message.version) {
      this.settle(message.file)

      return
    }

    if (entry.timer) {
      clearTimeout(entry.timer)
    }

    entry.timer = setTimeout(() => this.settle(message.file), this.options.graceMs ?? DEFAULT_GRACE_MS)
  }

  onError(message: ErrorMessage): void {
    const entry = this.pending.get(message.file)

    if (entry?.timer) {
      clearTimeout(entry.timer)
    }

    this.pending.delete(message.file)
  }

  private entry(file: string): PendingEntry {
    let entry = this.pending.get(file)

    if (!entry) {
      entry = { schema: null, invalidate: null, timer: null }

      this.pending.set(file, entry)
    }

    return entry
  }

  private settle(file: string): void {
    const entry = this.pending.get(file)

    if (!entry?.invalidate) {
      return
    }

    if (entry.timer) {
      clearTimeout(entry.timer)
      entry.timer = null
    }

    const invalidate = entry.invalidate
    const schema = entry.schema?.version.to === invalidate.version ? entry.schema : null

    entry.invalidate = null

    void this.resolve(invalidate, schema)
  }

  private async resolve(invalidate: InvalidateMessage, schema: SchemaMessage | null): Promise<void> {
    const runtime = this.runtime()

    if (!runtime) {
      this.note("no-runtime")
      this.reload(invalidate.file, "no client runtime")

      return
    }

    const regions = runtime.slots.regionsFor(invalidate.file)
    const versionMoved = schema ? schema.version.from !== null && schema.version.from !== schema.version.to : false

    if (versionMoved && invalidate.version && regions.some((region) => region.version === invalidate.version)) {
      return
    }

    if (regions.length === 0) {
      this.resolveWithoutRegions(invalidate, schema)

      return
    }

    if (schema && schema.mode === null) {
      this.note("no-slots")
      this.reload(invalidate.file, "template compiled without slots")

      return
    }

    const trail: string[] = []

    if (this.tierOne(runtime, regions, invalidate, schema, trail)) {
      return
    }

    if (this.tierTwo(runtime, regions, invalidate, schema, trail)) {
      return
    }

    const fetched = await this.tierThree(runtime, invalidate, schema, trail)

    if (fetched === true || fetched === "hold") {
      return
    }

    if (schema?.mode === "server") {
      this.note("server-mode")
    }

    this.reload(invalidate.file, trail.join(" -> "))
  }

  private resolveWithoutRegions(invalidate: InvalidateMessage, schema: SchemaMessage | null): void {
    const rendered = document.querySelector(`[${DEBUG_ROOT_ATTRIBUTE}="${CSS.escape(invalidate.file)}"]`)

    if (rendered) {
      if (schema && schema.mode === null) {
        this.note("no-slots")
      }

      this.reload(invalidate.file, "rendered without slot markers")

      return
    }

    if (document.querySelector(DEBUG_MODE_META)) {
      return
    }

    this.note("no-regions")
    this.reload(invalidate.file, "no regions and no way to prove absence")
  }

  private tierOne(runtime: Runtime, regions: Region[], invalidate: InvalidateMessage, schema: SchemaMessage | null, trail: string[]): boolean {
    if (invalidate.scope !== "state" || !schema || !invalidate.version) {
      trail.push("state: not eligible")

      return false
    }

    const conditionals = Object.keys(schema.manifest?.states?.conditionals ?? {}).length

    if (schema.mode === "server" && conditionals > 0) {
      trail.push("state: server mode with conditionals")

      return false
    }

    const before = runtime.slots.statesFor(invalidate.file, regions[0].version)
    const delta = diffStateManifests(before, schema.manifest?.states ?? null)

    if (!delta.stateDerivable) {
      trail.push("state: not derivable")

      return false
    }

    const rebound = regions.every((region) => rebindRegion(runtime, region, invalidate.version as string))

    if (!rebound) {
      trail.push("state: rebind failed")
    }

    return rebound
  }

  private tierTwo(runtime: Runtime, regions: Region[], invalidate: InvalidateMessage, schema: SchemaMessage | null, trail: string[]): boolean {
    if (invalidate.scope !== "static") {
      trail.push("static: not a static change, values may have moved")

      return false
    }

    if (!schema?.static_markup || !invalidate.version) {
      trail.push("static: no static markup")

      return false
    }

    const holdsItems = regions.some((region) =>
      [...region.slots.values()].some((slot) => slot.type === "collection" && slot.items.size > 0)
    )

    if (holdsItems) {
      trail.push("static: collections hold server items")

      return false
    }

    const states = schema.manifest?.states ?? null
    const structural = Object.keys(states?.conditionals ?? {}).length

    if (schema.mode === "server" && structural > 0) {
      trail.push("static: server mode with conditionals")

      return false
    }

    const owned = stateOwnedIndices(states)

    const rebuilt = regions.every((region) =>
      rebuildRegion(runtime, {
        region,
        version: invalidate.version as string,
        staticMarkup: schema.static_markup as string,
        remap: schema.remap?.slots ?? null,
        stateOwned: owned,
      })
    )

    if (!rebuilt) {
      trail.push("static: rebuild failed")
    }

    return rebuilt
  }

  private async tierThree(runtime: Runtime, invalidate: InvalidateMessage, schema: SchemaMessage | null, trail: string[]): Promise<boolean | "hold"> {
    try {
      const rebuild = schema?.static_markup && invalidate.version ? {
        version: invalidate.version,
        staticMarkup: schema.static_markup,
        remap: schema.remap?.slots ?? null,
        stateOwned: stateOwnedIndices(schema.manifest?.states ?? null),
        always: invalidate.scope === "static" || schema.version.from === null || schema.version.from === schema.version.to,
      } : undefined

      if (invalidate.scope === "static" && !rebuild) {
        trail.push("fetch: a static change with no static markup cannot apply")

        return false
      }

      const report = await refresh(runtime, invalidate.file, { needSchema: schema === null, rebuild })

      const blocked = report.deferred.some((deferral) =>
        deferral.reason === "branch" || deferral.reason === "items" || deferral.reason === "stale-version"
      )

      if (blocked) {
        trail.push("fetch: payload deferred")
      }

      return !blocked
    } catch (error) {
      const message = error instanceof Error ? error.message : "failed"

      trail.push(`fetch: ${message}`)

      if (/failed with 5\d\d/.test(message)) {
        console.warn(`[Herb Dev Tools] ${invalidate.file}: the server answered ${message.replace("Herb slots request ", "")}. Keeping the current page; check the diagnostics and the server log.`)

        return "hold"
      }

      return false
    }
  }

  private runtime(): Runtime | null {
    if (this.options.runtime) {
      return this.options.runtime()
    }

    return heldRuntime()
  }

  private note(cause: Cause): void {
    if (this.reported.has(cause)) {
      return
    }

    this.reported.add(cause)

    console.info(`[Herb Dev Tools] ${CAPABILITY_MESSAGES[cause]}`)

    this.options.sink?.()?.report(`herb-dev-server-capability-${cause}`, [
      {
        template: "(this page)",
        message: CAPABILITY_MESSAGES[cause],
        severity: "hint",
        origin: CAPABILITY_ORIGIN,
      },
    ])
  }

  private reload(file: string, why: string): void {
    const count = (this.reloadCounts.get(file) ?? 0) + 1

    this.reloadCounts.set(file, count)

    console.debug(`[Herb Dev Tools] reloading for ${file}: ${why}`)

    if (count >= REPEATED_RELOADS) {
      this.options.sink?.()?.report(`herb-dev-server-reloads-${file}`, [
        {
          template: file,
          message: `Edits to this template keep falling back to full reloads (${why}).`,
          severity: "hint",
          origin: CAPABILITY_ORIGIN,
        },
      ])
    }

    if (this.options.reload) {
      this.options.reload()

      return
    }

    window.location.reload()
  }
}
