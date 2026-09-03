export type SlotType =
  | "child"
  | "conditional"
  | "collection"
  | "block"
  | "comment"
  | "attribute"
  | "attribute_interpolation"
  | "boolean_attribute"
  | "element"
  | "raw_text"
  | "raw_text_interpolation"

export type SlotOperation =
  | "value"
  | "attribute"
  | "branch"
  | "branch-material"
  | "item-added"
  | "item-rekeyed"
  | "item-removed"
  | "item-updated"
  | "built"

export type BuildCause = "apply" | "client" | "rebuild"
export type RenderMode = "server" | "client"
export type ApplyMode = "replace" | "merge"

export type SlotValue = string | string[]
export type SlotValues = Record<number, SlotValue>
export type ItemValues = Record<number | string, SlotValue>
export type Seeds = Record<string, unknown>

export type SlotMap = Map<number, Slot>
export type ItemMap = Map<string, Item>
export type FragmentMap = Map<string, DocumentFragment>
export type NameMap = Map<string, number>

export type AttributeParts = string[]
export type PartsResolver = (index: number) => AttributeParts | null

export type Marker = Comment | Element
export type RevertToken = number
export type Inverse = () => void
export type Restore = (live: Slot) => void

export type PayloadItems = Record<string, PayloadSlots>
export type SeededSlots = PayloadSlots & { seeds?: Seeds }
export type PayloadValue = string | string[] | boolean | Payload | Branched | Collected
export type AppliedValue = Exclude<PayloadValue, Payload>
export type DeferredReason = "no-region" | "stale-version" | "no-slot" | "branch" | "block" | "items" | "partial-attribute" | "partial-content"

export type SlotAnchor = RangeAnchor | ElementAnchor | ContentAnchor

export interface SlotsDelegate {
  valueWritten?(slot: Slot): void
  attributeWritten?(slot: Slot): void
  branchSwitched?(slot: Slot): void
  branchMaterial?(slot: Slot): void
  itemAdded?(slot: Slot, key: string, item: Item | null): void
  itemRemoved?(slot: Slot, key: string, item: Item | null): void
  itemUpdated?(slot: Slot, key: string, item: Item | null): void
  itemRekeyed?(slot: Slot, key: string, previousKey: string, item: Item | null): void
  built?(built: Built): void
}

export interface Bounds {
  start: Comment
  end: Comment
}

export interface RangeAnchor extends Bounds {
  kind: "range"
}

export interface ElementAnchor {
  kind: "element"
  element: Element
}

export interface ContentAnchor {
  kind: "content"
  element: Element
}

export interface Slot {
  index: number
  type: SlotType
  attribute: string | null
  anchor: SlotAnchor
  items: ItemMap
  branch: number | null
  parent: Slot | null
  children: Slot[]
  region: Region
  item: Item | null
  claimed: boolean
  shown: Map<number, SlotValues> | null
  captured: Map<number, DocumentFragment> | null
}

export interface Item extends Bounds {
  key: string
  slots: SlotMap
  collection: Slot
  seeds?: Seeds
}

export interface RegionRange {
  start: Comment
  end: Comment | null
}

export interface Region {
  file: string
  version: string
  occurrence: number
  ranges: RegionRange[]
  slots: SlotMap
  seeds?: Seeds
}

export interface ScanResult {
  regions: Region[]
  slots: Slot[]
}

export interface Placement {
  region: Region
  slot: Slot | null
  item: Item | null
}

export interface ScanContext {
  region?: Region | null
  slot?: Slot | null
  item?: Item | null
}

export interface AnchorEntry {
  index: number
  type: SlotType
  attribute: string | null
}

export interface NameEntry {
  index: number
  name: string
}

export interface StaticsIdentity {
  file: string
  version: string
}

export interface SlotAddress {
  region: Region
  path: ItemStep[]
  index: number
}

export interface ItemStep {
  collection: number
  key: string
}

export interface OpenSlot {
  index: number
  slot: Slot
}

export interface OpenItem {
  slot: number
  item: Item
}

export interface OpenRegion {
  region: Region
  range: RegionRange
}

export interface ParseState {
  openRegions: OpenRegion[]
  openSlots: OpenSlot[]
  openItems: OpenItem[]
}

export interface SlotEventDetail {
  file: string
  occurrence: number
  index: number
  operation: SlotOperation
  key: string | null
  previousKey: string | null
  slot: Slot | null
  item: Item | null
  cause: BuildCause
  built?: Built
}

export interface Built {
  branches: Slot[]
  items: { slot: Slot; item: Item }[]
}

export interface Payload {
  template: string
  version: string
  occurrence: number
  seeds?: Seeds
  slots: PayloadSlots
}

export interface PayloadSlots {
  [index: string]: PayloadValue
}

export interface Branched {
  branch: number | null
  statics?: string
  slots?: PayloadSlots
}

export interface Collected {
  items: PayloadItems
  order?: string[]
}

export interface Deferred {
  file: string
  occurrence: number
  index: number | null
  reason: DeferredReason
  keys?: string[]
}

export interface ApplyReport {
  applied: number
  deferred: Deferred[]
}

export interface ItemPlan {
  added: string[]
  removed: string[]
  moved: string[]
  kept: string[]
  unchanged: boolean
}

export interface AddItemOptions {
  values?: ItemValues
  before?: string
  text?: boolean
}

export interface ApplyOptions {
  items?: ApplyMode
}

export interface TransactionResult<T> {
  token: RevertToken | null
  result: T
}
