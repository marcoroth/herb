import { parseMarker, regionOpenMarker } from "@herb-tools/client"

import type { Region, Runtime } from "@herb-tools/client"

export function rebindRegion(runtime: Runtime, region: Region, version: string): boolean {
  const rewritten = region.ranges.every((range) => {
    const marker = parseMarker(range.start.data)

    if (marker?.kind !== "region-open") {
      return false
    }

    range.start.data = regionOpenMarker(marker.file, version, marker.occurrence)

    return true
  })

  if (!rewritten) {
    return false
  }

  region.version = version

  runtime.state.resettle(region)

  return true
}
