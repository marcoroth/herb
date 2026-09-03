import type { RuntimeDiagnostic } from "../runtime/report"
import type { TemplateManifest } from "@herb-tools/client"

export interface HelloMessage {
  type: "hello"
  role: "browser"
  capabilities?: {
    runtime: boolean
    regions: number
  }
}

export interface SchemaVersion {
  from: string | null
  to: string | null
}

export interface SchemaMessage {
  type: "schema"
  file: string
  mode: "client" | "server" | null
  version: SchemaVersion
  manifest: TemplateManifest | null
  static_markup: string | null
  changed_statics?: string[] | null
  statics: Record<string, string> | null
  remap: { slots: Record<string, number | null> } | null
  diagnostics: RuntimeDiagnostic[]
  source: string | null
}

export interface InvalidateMessage {
  type: "invalidate"
  file: string
  version: string | null
  node_path: number[]
  scope: "state" | "static" | "fetch"
}

export interface ParseError {
  name: string
  message: string
  line: number
  column: number
  code?: string
  origin?: string
  suggestion?: string | null
}

export interface ErrorMessage {
  type: "error"
  file: string
  errors: ParseError[]
  source?: string
}

export interface WelcomeMessage {
  type: "welcome"
  project: string
  compiler?: boolean
}

export const DEV_SERVER_COMMAND = "bundle exec herb dev"

export interface AssetMessage {
  type: "asset"
  kind: "stylesheet" | "script"
  file: string
}

export type HerbMessage = WelcomeMessage | SchemaMessage | InvalidateMessage | ErrorMessage | AssetMessage
export type ConnectionState = "connected" | "disconnected" | "given-up"
export type MessageHandler = (message: HerbMessage) => void

export interface ConnectionOptions {
  url: string
  reconnectInterval?: number
  maxReconnectAttempts?: number
  onMessage?: MessageHandler
  onConnect?: () => void
  onDisconnect?: () => void
  onGivenUp?: () => void
  onReconnecting?: (attempt: number, maxAttempts: number, delay: number) => void
}

export interface DiagnosticSink {
  report(file: string, diagnostics: RuntimeDiagnostic[]): void
  clear(file: string): void
  clearAll(): void
}

export interface HotReloadHandler {
  onSchema(message: SchemaMessage): void
  onInvalidate(message: InvalidateMessage): void
  onError(message: ErrorMessage): void
  onAsset(message: AssetMessage): void
}

export interface HerbClientOptions {
  port?: number
  host?: string
  diagnostics?: () => DiagnosticSink | null
  hotReload?: HotReloadHandler
  onSchema?: (message: SchemaMessage) => void
  onInvalidate?: (message: InvalidateMessage) => void
  onError?: (message: ErrorMessage) => void
  onAsset?: (message: AssetMessage) => void
  onConnect?: () => void
  onDisconnect?: () => void
}
