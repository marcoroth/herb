import type { Seeds, SlotType, StaticsIdentity } from "./types"

const REGION_OPEN = /^herb-region:(.*):([0-9a-f]+):(\d+)$/
const REGION_CLOSE = /^\/herb-region:(.*)$/
const SLOT_OPEN = /^herb-slot:(\d+)(?::([a-z_]+))?$/
const SLOT_CLOSE = /^\/herb-slot:(\d+)$/
const ITEM_OPEN = /^herb-item:(\d+):([\s\S]*)$/
const ITEM_CLOSE = /^\/herb-item:(\d+)$/
const BRANCH = /^herb-branch:(\d+):(\w+)$/
const SEEDS = /^herb-seeds:([\s\S]*)$/
const MARKER = /^\/?herb-(region|slot|item|branch|seeds):/
const STATICS_REGION = /^(.*):([0-9a-f]+)$/
const NUMERIC = /^\d+$/

export const ITEM_STATICS = "item"
export const PARTS_STATICS = "parts"
export const PART_MARKER = "herb-part"
export const DEFAULT_SLOT_TYPE: SlotType = "child"
export const CONTENT_SLOT_TYPES: SlotType[] = ["child", "raw_text"]

export interface RegionOpenMarker {
  kind: "region-open"
  file: string
  version: string
  occurrence: number
}

export interface RegionCloseMarker {
  kind: "region-close"
  file: string
}

export interface SlotOpenMarker {
  kind: "slot-open"
  index: number
  type: SlotType
}

export interface SlotCloseMarker {
  kind: "slot-close"
  index: number
}

export interface ItemOpenMarker {
  kind: "item-open"
  index: number
  key: string
}

export interface ItemCloseMarker {
  kind: "item-close"
  index: number
}

export interface SeedsMarker {
  kind: "seeds"
  seeds: Seeds
}

export interface BranchMarker {
  kind: "branch"
  index: number
  branch: string
}

export type MarkerData =
  | RegionOpenMarker
  | RegionCloseMarker
  | SlotOpenMarker
  | SlotCloseMarker
  | ItemOpenMarker
  | ItemCloseMarker
  | SeedsMarker
  | BranchMarker

export function isMarker(data: string): boolean {
  return MARKER.test(data)
}

export function parseMarker(data: string): MarkerData | null {
  const regionOpen = REGION_OPEN.exec(data)

  if (regionOpen) {
    return { kind: "region-open", file: regionOpen[1], version: regionOpen[2], occurrence: Number(regionOpen[3]) }
  }

  const regionClose = REGION_CLOSE.exec(data)

  if (regionClose) {
    return { kind: "region-close", file: regionClose[1] }
  }

  const slotOpen = SLOT_OPEN.exec(data)

  if (slotOpen) {
    return { kind: "slot-open", index: Number(slotOpen[1]), type: (slotOpen[2] as SlotType) ?? DEFAULT_SLOT_TYPE }
  }

  const slotClose = SLOT_CLOSE.exec(data)

  if (slotClose) {
    return { kind: "slot-close", index: Number(slotClose[1]) }
  }

  const itemOpen = ITEM_OPEN.exec(data)

  if (itemOpen) {
    return { kind: "item-open", index: Number(itemOpen[1]), key: itemOpen[2] }
  }

  const itemClose = ITEM_CLOSE.exec(data)

  if (itemClose) {
    return { kind: "item-close", index: Number(itemClose[1]) }
  }

  const seeds = SEEDS.exec(data)

  if (seeds) {
    return { kind: "seeds", seeds: parseSeeds(seeds[1]) }
  }

  return branchOf(data)
}

export function branchOf(data: string): BranchMarker | null {
  const branch = BRANCH.exec(data)

  if (!branch) {
    return null
  }

  return { kind: "branch", index: Number(branch[1]), branch: branch[2] }
}

export function slotOpenIndex(data: string): number | null {
  const open = SLOT_OPEN.exec(data)

  if (!open) {
    return null
  }

  return Number(open[1])
}

export function numericBranch(branch: string): number | null {
  if (!NUMERIC.test(branch)) {
    return null
  }

  return Number(branch)
}

export function itemMarker(index: number, key: string): string {
  return `herb-item:${index}:${key}`
}

export function slotCloseMarker(index: number): string {
  return `/herb-slot:${index}`
}

export function branchKey(index: number, branch: number | string): string {
  return `${index}:${branch}`
}

export function itemStaticsKey(index: number): string {
  return branchKey(index, ITEM_STATICS)
}

export function partsKey(index: number): string {
  return branchKey(index, PARTS_STATICS)
}

export function parseStaticsIdentity(named: string): StaticsIdentity | null {
  const match = STATICS_REGION.exec(named)

  if (!match) {
    return null
  }

  return { file: match[1], version: match[2] }
}

export function parseSeeds(json: string): Seeds {
  try {
    const parsed = JSON.parse(json) as unknown

    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {}
    }

    return parsed as Seeds
  } catch {
    return {}
  }
}
