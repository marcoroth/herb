export interface DiffOperation {
  type: string
  path: number[]
  old_value: string | null
  new_value: string | null
  old_node_type: string | null
  new_node_type: string | null
}

export interface PatchMessage {
  type: "patch"
  file: string
  operations: DiffOperation[]
}

export interface ReloadMessage {
  type: "reload"
  file: string
}

export interface ParseError {
  name: string
  message: string
  line: number
  column: number
}

export interface ErrorMessage {
  type: "error"
  file: string
  errors: ParseError[]
}

export interface FixedMessage {
  type: "fixed"
  file: string
}

export interface WelcomeMessage {
  type: "welcome"
  project: string
}

export type HerbMessage = WelcomeMessage | PatchMessage | ReloadMessage | ErrorMessage | FixedMessage

export type ConnectionState = "connected" | "disconnected" | "gave-up"

export type MessageHandler = (message: HerbMessage) => void

export interface ConnectionOptions {
  url: string
  reconnectInterval?: number
  maxReconnectAttempts?: number
  onMessage?: MessageHandler
  onConnect?: () => void
  onDisconnect?: () => void
  onGiveUp?: () => void
  onReconnecting?: (attempt: number, maxAttempts: number, delay: number) => void
}

export interface HerbClientOptions {
  port?: number
  host?: string
  onPatch?: (message: PatchMessage) => void
  onReload?: (message: ReloadMessage) => void
  onError?: (message: ErrorMessage) => void
  onFixed?: (message: FixedMessage) => void
  onConnect?: () => void
  onDisconnect?: () => void
}
