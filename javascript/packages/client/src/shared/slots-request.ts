import { mutationSettled } from "./mutation-refresh"
import { report } from "./report"

import type { Payload } from "../types"
import type { RuntimeDiagnostic } from "./types"

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
  body?: FormData | URLSearchParams | Record<string, unknown>
  headers?: Record<string, string>
  format?: string
  schema?: boolean
  nodePath?: number[]
  state?: Record<string, Record<string, unknown>>
  signal?: AbortSignal
  report?: boolean
  refresh?: boolean
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

export async function slotsRequest(url: string | URL, options: SlotsRequestOptions = {}): Promise<SlotsResponse> {
  const target = new URL(url.toString(), window.location.href)
  const method = (options.method ?? "GET").toUpperCase()
  const headers = slotsHeaders(options)

  let body: FormData | URLSearchParams | string | undefined

  if (options.body instanceof FormData || options.body instanceof URLSearchParams) {
    body = options.body
  } else if (options.body) {
    body = JSON.stringify(options.body)
    headers["Content-Type"] ??= "application/json"
  }

  if (method !== "GET" && method !== "HEAD") {
    const token = csrfToken()

    if (token) {
      headers["X-CSRF-Token"] ??= token
    }
  }

  target.searchParams.set("format", options.format ?? "slots")

  const response = await fetch(target.toString(), { method, body, headers, signal: options.signal })

  if (!response.ok) {
    const failure = await failureOf(response)

    if (options.report !== false) {
      report(failureDiagnostic(response.status, failure))
    }

    throw new SlotsRequestError(response.status, failure)
  }

  if (method !== "GET" && method !== "HEAD" && options.refresh !== false) {
    mutationSettled()
  }

  if (response.status === 204) {
    return { template: "", version: "", occurrence: 0, slots: {} }
  }

  return (await response.json()) as SlotsResponse
}

function csrfToken(): string | null {
  if (typeof document === "undefined") {
    return null
  }

  return document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? null
}

function failureDiagnostic(status: number, failure: SlotsRequestFailure | null): RuntimeDiagnostic {
  return {
    template: failure?.template ?? "",
    message: failure?.message ?? `The application answered ${status}. Check the server log.`,
    code: failure?.class ?? "RuntimeError",
    severity: "error",
    origin: "Web Application",
    phase: "runtime",
    overlay: "dismissible",
    ...(failure?.line ? { location: { start: { line: failure.line, column: 1 } } } : {}),
    ...(failure?.backtrace?.length ? { backtrace: failure.backtrace } : {}),
  }
}

async function failureOf(response: Response): Promise<SlotsRequestFailure | null> {
  try {
    const body = await response.json() as { error?: SlotsRequestFailure }

    return body?.error ?? null
  } catch {
    return null
  }
}
