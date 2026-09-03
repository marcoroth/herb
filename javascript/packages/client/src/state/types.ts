export type ConditionValue = string | number | boolean | null
export type ConditionalArm = Arm | ComboArm | [string, StateComparand, number | null] | [string, StateComparand, number | null, string]
export type StateComparand = null | { state: string, transform?: string } | { value: ConditionValue } | string
export type StateCondition = [string, StateComparand] | [string, StateComparand, string] | [string, StateComparand, string | null, string] | ComboCondition
export type ValueOf = (name: string) => ConditionValue

export interface ComboCondition {
  all?: StateCondition[]
  any?: StateCondition[]
}

export interface Arm {
  branch: number | null
  condition: StateCondition
}

export interface ComboArm extends ComboCondition {
  branch: number | null
}

export interface Conditional {
  arms: ConditionalArm[]
  else: number | null
}

import type { ApplyReport, Item, Payload, Region, Slot } from "../types"
import type { StateKind, StateValue } from "./values"

export type StateMode = "identity" | "structural" | "derived"
export type StateTransport = (request: StateRequest, signal: AbortSignal) => Promise<Payload | null>
export type StateListener = (value: StateValue, previous: StateValue) => void
export type StateWaiter = (report: StateReport) => void

export type StateValues = Record<string, StateValue>
export type SerializedState = Record<string, string>
export type StateIndices = Record<string, number[]>
export type ConditionalMap = Record<string, Conditional>
export type PresenceMap = Record<string, StateCondition>
export type ComputedMap = Record<string, StateCondition>
export type ResolvedStateOptions = Required<Omit<StateOptions, "transport" | "refetchTransport">> & { transport: StateTransport; refetchTransport?: RefreshTransport }

export type StateBucket = Map<string, StateValue>
export type ScopeStore = Map<Region, Map<string, StateBucket>>

export interface DeclaredState {
  name: string
  kind: StateKind
  default: string
  value?: StateValue
  derived?: StateCondition | null
  count?: StateCount | null
  scope: "region" | number
  line?: number | null
  column?: number | null
}

export interface StateCount {
  collection: number
  when: StateCondition | null
  by?: number
}

export interface ServerMap {
  branches?: Record<string, ServerRead[]>
  reads?: Record<string, ServerRead[]>
}

export interface ServerRead {
  index: number
  node_path: number[]
}

export interface StateManifest {
  version: string
  declarations: DeclaredState[]
  reads: StateIndices
  bound?: StateIndices
  conditionals: ConditionalMap
  presence?: PresenceMap
  computed?: ComputedMap
  server?: ServerMap
  fragments?: Record<string, FragmentEntry>
}

export interface FragmentEntry {
  fallback: number
  reads: number[]
  delay?: number
  hold?: number
}

export interface StateScope {
  region: Region
  item: Item | null
}

export interface StateChangeDetail {
  name: string
  value: StateValue
  previous: StateValue
  file: string
  occurrence: number
  key: string | null
}

export interface ScopedSetOptions {
  scope?: StateScope | Element
}

export interface CountOptions extends ScopedSetOptions {
  by?: number
}

export interface PlacedSlot {
  slot: Slot
  scope: StateScope
}

export interface BoundState {
  name: string
  scope: StateScope
  manifest: StateManifest
}

export interface StateSnapshot {
  name: string
  previous: StateValue
}

export interface StateChange extends StateSnapshot {
  value: StateValue
}

export interface StateSlot {
  file: string
  version: string
  index: number
}

export interface DependencyMap {
  state: Record<string, StateSlot[]>
  params?: Record<string, string>
  states?: Record<string, StateManifest>
}

export interface StateRequest {
  state: SerializedState
  changed: string[]
}

export interface StateOptions {
  transport?: StateTransport
  debounce?: number
  format?: string
  refetch?: "auto" | "off"
  refetchDebounce?: number
  refetchTransport?: RefreshTransport
}

export type RefreshTransport = (state: Record<string, Record<string, unknown>>, signal: AbortSignal) => Promise<Payload>

export interface StateReport extends ApplyReport {
  written: number
  restored: number
  stale: boolean
  failed: boolean
}
