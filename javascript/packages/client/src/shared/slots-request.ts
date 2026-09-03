import type { Payload } from "../types"

export const SLOTS_MIME_TYPE = "application/vnd.herb.slots+json"
export const SCHEMA_HEADER = "Herb-Schema"
export const NODE_PATH_HEADER = "Herb-Node-Path"
export const STATE_HEADER = "Herb-State"

export type SlotsResponse = Payload & { schema?: SchemaEnvelope }

export interface SlotsRequestFailure {
  class?: string
  message?: string
  template?: string | null
  line?: number | null
  backtrace?: string[] | null
}

export class SlotsRequestError extends Error {
  readonly status: number
  readonly failure: SlotsRequestFailure | null

  constructor(status: number, failure: SlotsRequestFailure | null) {
    super(`Herb slots request failed with ${status}`)

    this.status = status
    this.failure = failure
  }
}

export interface SchemaEnvelope {
  mode: string | null
  version: string
  manifest: Record<string, unknown> | null
  static_markup: string | null
  statics: Record<string, string> | null
}

export interface SlotsRequestOptions {
  method?: string
  body?: FormData | URLSearchParams
  headers?: Record<string, string>
  format?: string
  schema?: boolean
  nodePath?: number[]
  state?: Record<string, Record<string, unknown>>
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

  if (options.state && Object.keys(options.state).length > 0) {
    headers[STATE_HEADER] = asciiJSON(options.state)
  }

  return headers
}

function asciiJSON(value: unknown): string {
  return JSON.stringify(value).replace(/[\u007f-\uffff]/g, (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`)
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
    throw new SlotsRequestError(response.status, await failureOf(response))
  }

  return (await response.json()) as SlotsResponse
}

async function failureOf(response: Response): Promise<SlotsRequestFailure | null> {
  try {
    const body = await response.json() as { error?: SlotsRequestFailure }

    return body?.error ?? null
  } catch {
    return null
  }
}
