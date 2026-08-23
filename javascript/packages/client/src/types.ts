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

export type SlotOperation =
  | "value"
  | "attribute"
  | "markup"
  | "branch"
  | "item-added"
  | "item-rekeyed"
  | "item-removed"
  | "item-updated"

export type RenderMode = "server" | "client"
export type ApplyMode = "replace" | "merge"
export type TemplateSource = "live" | "skeleton"

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
export type DeferredReason = "no-region" | "stale-version" | "no-slot" | "branch" | "items" | "partial-attribute"

export type SlotAnchor = RangeAnchor | ElementAnchor | ContentAnchor

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
  start: Comment | null
  end: Comment | null
  slots: SlotMap
  names: NameMap
  seeds?: Seeds
}

export interface ScanResult {
  regions: Region[]
  slots: Slot[]
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

export interface Statics {
  version: string
  fragments: FragmentMap
}

export interface SlotAddress {
  region: Region
  collection: number | null
  key: string | null
  index: number
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
}

export interface Payload {
  template: string
  version: string
  occurrence: number
  slots: PayloadSlots
}

export interface PayloadSlots {
  [index: string]: PayloadValue
}

export interface Branched {
  branch: number | null
  slots?: PayloadSlots
}

export interface Collected {
  items: PayloadItems
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
