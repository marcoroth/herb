import { Connection } from "./connection"
import { Toast } from "./toast"
import { ConnectionDot } from "./connection-dot"
import { MismatchAlert } from "./mismatch-alert"

import { applyPatch } from "./patch"

import type {
  HerbClientOptions,
  HerbMessage,
  WelcomeMessage,
  PatchMessage,
  ReloadMessage,
  ErrorMessage,
  FixedMessage,
} from "./types"

const DEFAULT_PORT = 8592

type ClientState = "connected" | "disconnected" | "gave-up"

export class HerbClient {
  private connection: Connection
  private options: HerbClientOptions
  private port: number
  private state: ClientState = "disconnected"
  private hasConnectedBefore = false
  private projectMatch: boolean | null = null
  private connectionDot: ConnectionDot

  constructor(options: HerbClientOptions = {}) {
    this.options = options

    const port = options.port ?? this.detectPort() ?? DEFAULT_PORT
    const host = options.host ?? "localhost"
    this.port = port
    this.connectionDot = new ConnectionDot(this)

    this.connection = new Connection({
      url: `ws://${host}:${port}`,
      onMessage: (message) => this.handleMessage(message),
      onConnect: () => this.onConnect(),
      onDisconnect: () => this.onDisconnect(),
      onReconnecting: (attempt, maxAttempts, delay) => this.onReconnecting(attempt, maxAttempts, delay),
      onGiveUp: () => this.onGaveUp(),
    })
  }

  connect(): void {
    this.connection.connect()
  }

  disconnect(): void {
    this.connection.disconnect()
  }

  retry(): void {
    this.updateState("disconnected")
    this.connection.retry()
  }

  getState(): ClientState {
    return this.state
  }

  getPort(): number {
    return this.port
  }

  applyConnectionDot(): void {
    this.connectionDot.apply()
  }

  private onConnect(): void {
    const wasDisconnected = this.state === "disconnected" || this.state === "gave-up"

    if (this.hasConnectedBefore && wasDisconnected) {
      Toast.show("Herb Dev Server reconnected", "connected")
    }

    this.hasConnectedBefore = true
    this.updateState("connected")
    this.options.onConnect?.()
  }

  private onDisconnect(): void {
    if (this.hasConnectedBefore && this.state === "connected") {
      Toast.show("Herb Dev Server disconnected", "disconnected")
    }

    this.updateState("disconnected")
    this.options.onDisconnect?.()
  }

  private onReconnecting(attempt: number, maxAttempts: number, delay: number): void {
    console.debug(`[herb-client] reconnecting (attempt ${attempt}/${maxAttempts}, next try in ${(delay / 1000).toFixed(1)}s)...`)
    this.connectionDot.updateReconnectCountdown(attempt, maxAttempts, delay)
  }

  private onGaveUp(): void {
    this.updateState("gave-up")
    Toast.show("Herb Dev Server not available — click the dot to retry", "warning")
  }

  private handleMessage(message: HerbMessage): void {
    if (message.type !== "welcome" && this.projectMatch === false) return

    switch (message.type) {
      case "welcome":
        this.handleWelcome(message)
        break
      case "patch":
        this.handlePatch(message)
        break
      case "reload":
        this.handleReload(message)
        break
      case "error":
        this.handleError(message)
        break
      case "fixed":
        this.handleFixed(message)
        break
    }
  }

  private handleWelcome(message: WelcomeMessage): void {
    const clientProject = document.querySelector('meta[name="herb-project-path"]')?.getAttribute("content")

    if (clientProject && message.project && clientProject !== message.project) {
      this.projectMatch = false
      console.warn(`[herb-client] project mismatch — server: ${message.project}, client: ${clientProject}. Ignoring messages.`)
      this.updateState("disconnected")
      MismatchAlert.show(message.project, clientProject)
    } else {
      this.projectMatch = true
    }
  }

  private handlePatch(message: PatchMessage): void {
    this.options.onPatch?.(message)

    const applied = applyPatch(message)

    if (!applied) {
      window.location.reload()
    }
  }

  private handleReload(message: ReloadMessage): void {
    this.options.onReload?.(message)
    window.location.reload()
  }


  private handleError(message: ErrorMessage): void {
    this.options.onError?.(message)

    const overlay = this.getErrorOverlay()

    if (overlay) {
      const errors = message.errors.map((error) => ({
        severity: "error" as const,
        message: error.message,
        name: error.name,
        location: { line: error.line, column: error.column },
      }))

      overlay.showErrors(errors, message.file)
    }
  }

  private handleFixed(message: FixedMessage): void {
    this.options.onFixed?.(message)
    this.getErrorOverlay()?.clearErrors()
  }

  private updateState(state: ClientState): void {
    this.state = state
    this.connectionDot.apply()
  }

  private getErrorOverlay(): any {
    return (window as any).HerbDevTools?._errorOverlay
      ?? (window as any).HerbDevTools?._overlay?.errorOverlay
      ?? null
  }

  private detectPort(): number | null {
    const meta = document.querySelector('meta[name="herb-dev-server-port"]')

    if (meta) {
      const port = parseInt(meta.getAttribute("content") ?? "", 10)
      if (!isNaN(port)) return port
    }

    return null
  }
}
