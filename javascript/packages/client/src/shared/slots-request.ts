import type { Payload } from "../types"

export const SLOTS_MIME_TYPE = "application/vnd.herb.slots+json"
export const SCHEMA_HEADER = "Herb-Schema"
export const NODE_PATH_HEADER = "Herb-Node-Path"

export type SlotsResponse = Payload & { schema?: SchemaEnvelope }

export interface SchemaEnvelope {
  mode: string | null
  version: string
  manifest: Record<string, unknown> | null
  skeleton: string | null
  statics: Record<string, string> | null
}

export interface SlotsRequestOptions {
  method?: string
  body?: FormData | URLSearchParams
  headers?: Record<string, string>
  format?: string
  schema?: boolean
  nodePath?: number[]
  signal?: AbortSignal
}

export function slotsHeaders(options: SlotsRequestOptions = {}): Record<string, string> {
  const headers: Record<string, string> = { Accept: SLOTS_MIME_TYPE, ...options.headers }

  if (options.schema) {
    headers[SCHEMA_HEADER] = "1"
  }

  if (options.nodePath) {
    headers[NODE_PATH_HEADER] = options.nodePath.join(",")
  }

  return headers
}

// TODO: should this use @rails/request.js?
export async function slotsRequest(url: string | URL, options: SlotsRequestOptions = {}): Promise<SlotsResponse> {
  const target = new URL(url.toString(), window.location.href)

  target.searchParams.set("format", options.format ?? "slots")

  const response = await fetch(target.toString(), {
    method: options.method ?? "GET",
    body: options.body,
    headers: slotsHeaders(options),
    signal: options.signal,
  })

  if (!response.ok) {
    throw new Error(`Herb slots request failed with ${response.status}`)
  }

  return (await response.json()) as SlotsResponse
}
