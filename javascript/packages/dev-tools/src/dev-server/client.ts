import { Toast } from "./toast"
import { Connection } from "./connection"
import { ConnectionDot } from "./connection-dot"
import { MismatchAlert } from "./mismatch-alert"
import { UnavailableAlert } from "./unavailable-alert"

import { diagnosticsFromError } from "./diagnostics"
import { heldRuntime } from "./runtime-handle"

import type { DiagnosticSink, HerbClientOptions, HerbMessage, WelcomeMessage, SchemaMessage, InvalidateMessage, ErrorMessage } from "./types"

const DEFAULT_PORT = 8592
const UNAVAILABLE_HINT_AFTER_ATTEMPTS = 3

type ClientState = "connected" | "disconnected" | "given-up"

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
      onGivenUp: () => this.onGivenUp(),
    })
  }

  connect(): void {
    this.connection.connect()
  }

  disconnect(): void {
    UnavailableAlert.hide()

    this.connection.disconnect()
  }

  retry(): void {
    UnavailableAlert.hide()

    this.updateState("disconnected")
    this.connection.retry()
  }

  getState(): ClientState {
    return this.state
  }

  getPort(): number {
    return this.port
  }

  refreshConnection(): void {
    this.connectionDot.apply()
  }

  applyConnectionDot(): void {
    this.connectionDot.apply()
  }

  private onConnect(): void {
    const wasDisconnected = this.state === "disconnected" || this.state === "given-up"

    if (this.hasConnectedBefore && wasDisconnected) {
      Toast.show("Herb Dev Server reconnected", "connected")
    }

    UnavailableAlert.reset()

    this.hasConnectedBefore = true
    this.updateState("connected")
    this.sendHello()
    this.options.onConnect?.()
  }

  private sendHello(): void {
    const runtime = heldRuntime()

    this.connection.send({
      type: "hello",
      role: "browser",
      capabilities: {
        runtime: Boolean(runtime),
        regions: runtime?.slots.regions().length ?? 0,
      },
    })
  }

  private onDisconnect(): void {
    if (this.hasConnectedBefore && this.state === "connected") {
      Toast.show("Herb Dev Server disconnected", "disconnected")
    }

    this.updateState("disconnected")
    this.options.onDisconnect?.()
  }

  private onReconnecting(attempt: number, maxAttempts: number, delay: number): void {
    console.debug(`[Herb Dev Client] reconnecting (attempt ${attempt}/${maxAttempts}, next try in ${(delay / 1000).toFixed(1)}s)...`)
    this.connectionDot.updateReconnectCountdown(attempt, maxAttempts, delay)

    if (!this.hasConnectedBefore && attempt >= UNAVAILABLE_HINT_AFTER_ATTEMPTS) {
      this.showUnavailableAlert()
    }
  }

  private onGivenUp(): void {
    this.updateState("given-up")
    this.showUnavailableAlert()
  }

  private showUnavailableAlert(): void {
    UnavailableAlert.show({ port: this.port, onRetry: () => this.retry() })
  }

  private handleMessage(message: HerbMessage): void {
    if (message.type !== "welcome" && this.projectMatch === false) return

    switch (message.type) {
      case "welcome":
        this.handleWelcome(message)
        break
      case "schema":
        this.handleSchema(message)
        break
      case "invalidate":
        this.handleInvalidate(message)
        break
      case "error":
        this.handleError(message)
        break
    }
  }

  private handleWelcome(message: WelcomeMessage): void {
    const clientProject = document.querySelector('meta[name="herb-project-path"]')?.getAttribute("content")

    if (clientProject && message.project && clientProject !== message.project) {
      this.projectMatch = false
      console.warn(`[Herb Dev Client] project mismatch — server: ${message.project}, client: ${clientProject}. Ignoring messages.`)
      this.updateState("disconnected")

      MismatchAlert.show(message.project, clientProject)
    } else {
      this.projectMatch = true
    }
  }

  private handleSchema(message: SchemaMessage): void {
    this.options.onSchema?.(message)

    this.getDiagnostics()?.report(message.file, message.diagnostics ?? [])

    this.options.hotReload?.onSchema(message)
  }

  private handleInvalidate(message: InvalidateMessage): void {
    this.options.onInvalidate?.(message)
    this.options.hotReload?.onInvalidate(message)
  }

  private handleError(message: ErrorMessage): void {
    this.options.onError?.(message)

    this.getDiagnostics()?.report(message.file, diagnosticsFromError(message))

    this.options.hotReload?.onError(message)
  }

  private updateState(state: ClientState): void {
    this.state = state
    this.connectionDot.apply()
  }

  private getDiagnostics(): DiagnosticSink | null {
    return this.options.diagnostics?.() ?? null
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
