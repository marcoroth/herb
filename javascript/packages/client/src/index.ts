import { Connection } from "./connection"
import { applyPatch } from "./patch"

import type {
  ConnectionOptions,
  ConnectionState,
  HerbClientOptions,
  HerbMessage,
  WelcomeMessage,
  PatchMessage,
  ReloadMessage,
  ErrorMessage,
  FixedMessage,
  DiffOperation,
  ParseError,
} from "./types"

export type {
  ConnectionOptions,
  ConnectionState,
  HerbClientOptions,
  HerbMessage,
  WelcomeMessage,
  PatchMessage,
  ReloadMessage,
  ErrorMessage,
  FixedMessage,
  DiffOperation,
  ParseError,
}

export { Connection, applyPatch }

const DEFAULT_PORT = 8592

export class HerbClient {
  private connection: Connection
  private options: HerbClientOptions
  private port: number
  private hasConnectedBefore = false

  constructor(options: HerbClientOptions = {}) {
    this.options = options

    const port = options.port ?? this.detectPort() ?? DEFAULT_PORT
    const host = options.host ?? "localhost"
    this.port = port

    this.hasConnectedBefore = false

    this.connection = new Connection({
      url: `ws://${host}:${port}`,
      onMessage: (message) => this.handleMessage(message),
      onConnect: () => {
        const wasDisconnected = (window as any).__herbClientState === "disconnected" || (window as any).__herbClientState === "gave-up"

        if (this.hasConnectedBefore && wasDisconnected) {
          this.showToast("Herb Dev Server reconnected", "connected")
        }
        this.hasConnectedBefore = true
        this.updateConnectionDot("connected")
        options.onConnect?.()
      },
      onDisconnect: () => {
        if (this.hasConnectedBefore && (window as any).__herbClientState === "connected") {
          this.showToast("Herb Dev Server disconnected", "disconnected")
        }
        this.updateConnectionDot("disconnected")
        options.onDisconnect?.()
      },
      onReconnecting: (attempt, maxAttempts, delay) => {
        this.updateReconnectStatus(attempt, maxAttempts, delay)
      },
      onGiveUp: () => {
        this.updateConnectionDot("gave-up")
        this.showToast("Herb Dev Server not available — click the dot to retry", "warning")
      },
    })
  }

  connect(): void {
    this.connection.connect()
  }

  disconnect(): void {
    this.connection.disconnect()
  }

  retry(): void {
    this.updateConnectionDot("disconnected")
    this.connection.retry()
  }

  private projectMatch: boolean | null = null

  private handleMessage(message: HerbMessage): void {
    switch (message.type) {
      case "welcome":
        this.handleWelcome(message)
        break

      case "patch":
        if (this.projectMatch === false) return
        this.handlePatch(message)
        break

      case "reload":
        if (this.projectMatch === false) return
        this.handleReload(message)
        break

      case "error":
        if (this.projectMatch === false) return
        this.handleError(message)
        break

      case "fixed":
        if (this.projectMatch === false) return
        this.handleFixed(message)
        break
    }
  }

  private handleWelcome(message: WelcomeMessage): void {
    const projectMeta = document.querySelector('meta[name="herb-project-path"]')
    const clientProject = projectMeta?.getAttribute("content")

    if (clientProject && message.project && clientProject !== message.project) {
      this.projectMatch = false
      console.warn(`[herb-client] project mismatch — server: ${message.project}, client: ${clientProject}. Ignoring messages.`)
      this.updateConnectionDot("disconnected")
      this.showMismatchAlert(message.project, clientProject)
    } else {
      this.projectMatch = true
      console.debug(`[herb-client] project matched: ${message.project}`)
    }
  }

  private showMismatchAlert(serverProject: string, clientProject: string): void {
    const existing = document.getElementById("herbProjectMismatchAlert")
    if (existing) return

    const serverName = serverProject.split("/").pop()
    const clientName = clientProject.split("/").pop()

    const alert = document.createElement("div")
    alert.id = "herbProjectMismatchAlert"
    alert.style.cssText = "position:fixed;top:32px;right:10px;z-index:999998;background:#fffbeb;border:1px solid #f59e0b;border-radius:8px;padding:12px 16px;max-width:320px;font-family:system-ui,sans-serif;font-size:13px;color:#92400e;box-shadow:0 4px 12px rgba(0,0,0,0.1);display:flex;gap:10px;align-items:flex-start;"

    alert.innerHTML = `
      <span style="font-size:18px;line-height:1;">⚠️</span>
      <div style="flex:1;">
        <div style="font-weight:600;margin-bottom:4px;">Herb Dev Server mismatch</div>
        <div style="font-size:12px;color:#a16207;">
          The dev server is watching <strong>${serverName}</strong> but this page is from <strong>${clientName}</strong>.
          Messages will be ignored.
        </div>
      </div>
      <button id="herbMismatchDismiss" style="background:none;border:none;cursor:pointer;font-size:16px;color:#92400e;padding:0;line-height:1;">✕</button>
    `

    document.body.appendChild(alert)

    document.getElementById("herbMismatchDismiss")?.addEventListener("click", () => {
      alert.remove()
    })

    const panelStatus = document.getElementById("herbDevServerStatus")
    const panelDot = document.getElementById("herbDevServerDot")

    if (panelStatus) {
      panelStatus.textContent = `Wrong project (${serverName})`
      panelStatus.style.color = "#d97706"
    }
    if (panelDot) panelDot.style.background = "#f59e0b"
  }

  private handlePatch(message: PatchMessage): void {
    this.options.onPatch?.(message)

    const applied = applyPatch(message)

    if (applied) {
      console.debug(`[herb-client] patched ${message.file} (${message.operations.length} operations)`)
    } else {
      console.debug(`[herb-client] no matching elements for ${message.file}, skipping`)
    }
  }

  private handleReload(message: ReloadMessage): void {
    this.options.onReload?.(message)
    console.debug(`[herb-client] reloading for ${message.file}`)
    window.location.reload()
  }

  private getErrorOverlay(): any {
    return (window as any).HerbDevTools?._errorOverlay
      ?? (window as any).HerbDevTools?._overlay?.errorOverlay
      ?? null
  }

  private handleError(message: ErrorMessage): void {
    this.options.onError?.(message)
    console.debug(`[herb-client] ${message.errors.length} error(s) in ${message.file}`)

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

    const overlay = this.getErrorOverlay()
    console.debug(`[herb-client] errors fixed in ${message.file}`, { overlay, devTools: (window as any).HerbDevTools })

    if (overlay) {
      overlay.clearErrors()
    } else {
      console.debug("[herb-client] no error overlay found to clear")
    }
  }

  private updateConnectionDot(state: "connected" | "disconnected" | "gave-up"): void {
    (window as any).__herbClientConnected = state === "connected"
    ;(window as any).__herbClientState = state

    if (this.reconnectCountdown) {
      clearInterval(this.reconnectCountdown)
      this.reconnectCountdown = null
    }

    this.applyConnectionDot()
  }

  private applyConnectionDot(): void {
    const dot = document.getElementById("herbConnectionDot")
    if (!dot) return

    const state = (window as any).__herbClientState ?? "disconnected"

    const panelDot = document.getElementById("herbDevServerDot")
    const panelStatus = document.getElementById("herbDevServerStatus")
    const panelRetry = document.getElementById("herbDevServerRetry") as HTMLButtonElement | null

    const setDot = (element: HTMLElement, background: string, glow: boolean, pulse: boolean) => {
      element.style.background = background
      element.style.boxShadow = glow ? "0 0 4px rgba(34, 197, 94, 0.5)" : "none"
      element.style.animation = pulse ? "herb-dot-pulse 2s ease-in-out infinite" : "none"
    }

    const retryHandler = (event: MouseEvent) => {
      event.stopPropagation()
      instance?.retry()
    }

    switch (state) {
      case "connected":
        setDot(dot, "#22c55e", true, true)
        dot.style.cursor = "default"
        dot.title = "Connected to herb dev server"
        dot.onclick = null

        if (panelDot) setDot(panelDot, "#22c55e", false, false)
        if (panelStatus) { panelStatus.textContent = `Dev Server connected (port ${this.port})`; panelStatus.style.color = "#059669" }
        if (panelRetry) panelRetry.style.display = "none"
        break

      case "disconnected":
        setDot(dot, "#ef4444", false, false)
        dot.style.cursor = "default"
        dot.title = "Disconnected from herb dev server"
        dot.onclick = null

        if (panelDot) setDot(panelDot, "#ef4444", false, false)
        if (panelStatus) { panelStatus.textContent = "Dev Server disconnected"; panelStatus.style.color = "#6b7280" }
        if (panelRetry) { panelRetry.style.display = "block"; panelRetry.onclick = retryHandler }
        break

      case "gave-up":
        setDot(dot, "#f59e0b", false, false)
        dot.style.cursor = "pointer"
        dot.title = "Connection to herb dev server failed — click to retry"
        dot.onclick = retryHandler

        if (panelDot) setDot(panelDot, "#f59e0b", false, false)
        if (panelStatus) { panelStatus.textContent = "Dev Server not available"; panelStatus.style.color = "#d97706" }
        if (panelRetry) { panelRetry.style.display = "block"; panelRetry.onclick = retryHandler }
        break
    }
  }

  private reconnectCountdown: ReturnType<typeof setInterval> | null = null

  private updateReconnectStatus(attempt: number, maxAttempts: number, delay: number): void {
    console.debug(`[herb-client] reconnecting (attempt ${attempt}/${maxAttempts}, next try in ${(delay / 1000).toFixed(1)}s)...`)

    const panelStatus = document.getElementById("herbDevServerStatus")

    if (!panelStatus) return
    if (this.reconnectCountdown) clearInterval(this.reconnectCountdown)

    let remaining = Math.ceil(delay / 1000)

    panelStatus.textContent = `Retry ${attempt}/${maxAttempts} in ${remaining}s`
    panelStatus.style.color = "#6b7280"

    this.reconnectCountdown = setInterval(() => {
      remaining--

      if (remaining <= 0) {
        if (this.reconnectCountdown) clearInterval(this.reconnectCountdown)
        panelStatus.textContent = `Retry ${attempt}/${maxAttempts} connecting...`
        return
      }

      panelStatus.textContent = `Retry ${attempt}/${maxAttempts} in ${remaining}s`
    }, 1000)
  }

  private showToast(message: string, type: "connected" | "disconnected" | "warning"): void {
    const existing = document.getElementById("herbDevServerToast")
    if (existing) existing.remove()

    const colors = {
      connected: { background: "#ecfdf5", border: "#10b981", text: "#065f46", icon: "🟢" },
      disconnected: { background: "#fef2f2", border: "#ef4444", text: "#991b1b", icon: "🔴" },
      warning: { background: "#fffbeb", border: "#f59e0b", text: "#92400e", icon: "🟡" },
    }

    const style = colors[type]

    const toast = document.createElement("div")
    toast.id = "herbDevServerToast"
    toast.style.cssText = `position:fixed;top:36px;right:10px;z-index:999997;background:${style.background};border:1px solid ${style.border};border-radius:8px;padding:8px 14px;font-family:system-ui,sans-serif;font-size:12px;color:${style.text};box-shadow:0 4px 12px rgba(0,0,0,0.1);display:flex;align-items:center;gap:8px;transition:opacity 0.3s ease;`
    toast.innerHTML = `<span>${style.icon}</span><span>${message}</span>`

    document.body.appendChild(toast)

    setTimeout(() => {
      toast.style.opacity = "0"
      setTimeout(() => toast.remove(), 300)
    }, 3000)
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

let instance: HerbClient | null = null

export function initHerbClient(options: HerbClientOptions = {}): HerbClient {
  if (instance) {
    instance.disconnect()
  }

  instance = new HerbClient(options)
  ;(window as any).__herbClient = instance
  instance.connect()

  return instance
}

export function getHerbClient(): HerbClient | null {
  return instance
}

function autoInitialize(): void {
  const debugMeta = document.querySelector('meta[name="herb-debug-mode"]')

  console.debug("[herb-client] auto-init check:", {
    debugMeta: debugMeta?.getAttribute("content"),
    readyState: document.readyState,
    port: document.querySelector('meta[name="herb-dev-server-port"]')?.getAttribute("content"),
  })

  if (!debugMeta || debugMeta.getAttribute("content") !== "true") return

  initHerbClient()
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoInitialize)
  } else {
    autoInitialize()
  }
}
