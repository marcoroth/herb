import { slotsRequest } from "@herb-tools/client"
import { rebuildRegion, stateOwnedIndices } from "./rebuild"

import type { ApplyReport, Runtime, TemplateManifest } from "@herb-tools/client"
import type { SchemaEnvelope, SlotsResponse } from "@herb-tools/client"

export interface RefreshRebuild {
  version: string
  staticMarkup: string
  changedStatics?: Set<string>
  staticsUnsupported?: boolean
  remap?: Record<string, number | null> | null
  stateOwned?: Set<number>
  always?: boolean
}

export interface RefreshOptions {
  needSchema?: boolean
  nodePath?: number[]
  signal?: AbortSignal
  rebuild?: RefreshRebuild
}

function adoptEnvelope(runtime: Runtime, envelope: SchemaEnvelope, file: string): void {
  const manifest = envelope.manifest as TemplateManifest | null

  if (manifest) {
    runtime.slots.adoptManifests({ [`${manifest.file}:${manifest.version}`]: manifest }, { replace: true })
  }

  if (envelope.statics) {
    runtime.slots.holdStatics({ file, version: envelope.version }, envelope.statics)
  }
}

function rebuildDirective(options: RefreshOptions, response: SlotsResponse): RefreshRebuild | null {
  if (options.rebuild) {
    return options.rebuild
  }

  const envelope = response.schema

  if (!envelope?.static_markup) {
    return null
  }

  return {
    version: response.version,
    staticMarkup: envelope.static_markup,
    remap: null,
    stateOwned: stateOwnedIndices((envelope.manifest as TemplateManifest | null)?.states ?? null),
  }
}

function rebuildRegions(runtime: Runtime, file: string, rebuild: RefreshRebuild): void {
  for (const region of runtime.slots.regionsFor(file)) {
    if (!rebuild.always && region.version === rebuild.version) {
      continue
    }

    rebuildRegion(runtime, {
      region,
      version: rebuild.version,
      staticMarkup: rebuild.staticMarkup,
      changedStatics: rebuild.changedStatics,
      staticsUnsupported: rebuild.staticsUnsupported,
      remap: rebuild.remap ?? null,
      stateOwned: rebuild.stateOwned,
    })
  }
}

export async function refresh(runtime: Runtime, file: string, options: RefreshOptions = {}): Promise<ApplyReport> {
  const response = await slotsRequest(window.location.href, {
    schema: options.needSchema,
    nodePath: options.nodePath,
    signal: options.signal,
  })

  if (response.schema && typeof runtime.slots.holdStatics === "function") {
    adoptEnvelope(runtime, response.schema, file)
  }

  const rebuild = rebuildDirective(options, response)

  if (rebuild) {
    rebuildRegions(runtime, file, rebuild)
  }

  const report = runtime.slots.apply(response)

  if (rebuild && typeof runtime.state.resettle === "function") {
    for (const region of runtime.slots.regionsFor(file)) {
      if (region.version === rebuild.version) {
        runtime.state.resettle(region)
      }
    }
  }

  return report
}
