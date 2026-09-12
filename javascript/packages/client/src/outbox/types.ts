import type { ApplyReport, ItemValues, Payload, Slot } from "../types"

export type MutationStatus = "confirmed" | "failed" | "stale" | "detached"
export type MutationTransport = (request: MutationRequest, signal: AbortSignal) => Promise<Payload | null>
export type ConfirmKey = (payload: Payload, temp: string) => string | null

export type MutationFields = Record<string, string>
export type MutationBody = FormData | MutationFields
export type HeaderMap = Record<string, string>

export interface MutationTarget {
  file: string
  index?: number
  name?: string
  occurrence?: number
}

export interface SubmitOptions {
  url: string
  method?: string
  body?: MutationBody
  into: MutationTarget
  values?: ItemValues
  key?: string
  confirmKey?: ConfirmKey
}

export interface MutationResult {
  status: MutationStatus
  key: string
  report?: ApplyReport
  error?: Error
}

export interface MutationRequest {
  url: string
  method: string
  body: MutationBody | undefined
  headers: HeaderMap
}

export interface OutboxOptions {
  transport?: MutationTransport
  headers?: () => HeaderMap
  format?: string
}

export interface Sending {
  options: SubmitOptions
  key: string
  slot: Slot | null
  inserted?: Promise<void>
}
