import type { HerbMessage, ConnectionOptions } from "./types"

const DEFAULT_RECONNECT_INTERVAL = 1000
const DEFAULT_MAX_RECONNECT_ATTEMPTS = 10

export class Connection {
  private socket: WebSocket | null = null
  private reconnectAttempts = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private givenUp = false
  private options: ConnectionOptions

  constructor(options: ConnectionOptions) {
    this.options = {
      reconnectInterval: DEFAULT_RECONNECT_INTERVAL,
      maxReconnectAttempts: DEFAULT_MAX_RECONNECT_ATTEMPTS,
      ...options,
    }
  }

  private get reconnectInterval(): number {
    return this.options.reconnectInterval ?? DEFAULT_RECONNECT_INTERVAL
  }

  private get maxReconnectAttempts(): number {
    return this.options.maxReconnectAttempts ?? DEFAULT_MAX_RECONNECT_ATTEMPTS
  }

  connect(): void {
    if (this.socket?.readyState === WebSocket.OPEN) return

    this.givenUp = false
    this.reconnectAttempts = 0

    this.attemptConnect()
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    this.givenUp = false
    this.reconnectAttempts = this.maxReconnectAttempts

    if (this.socket) {
      this.socket.close()
      this.socket = null
    }
  }

  retry(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    if (this.socket) {
      this.socket.onclose = null
      this.socket.close()
      this.socket = null
    }

    this.givenUp = false
    this.reconnectAttempts = 0
    this.attemptConnect()
  }

  get hasGivenUp(): boolean {
    return this.givenUp
  }

  private attemptConnect(): void {
    try {
      this.socket = new WebSocket(this.options.url)

      this.socket.onopen = () => {
        this.reconnectAttempts = 0
        this.options.onConnect?.()
      }

      this.socket.onmessage = (event) => {
        try {
          const message: HerbMessage = JSON.parse(event.data)
          this.options.onMessage?.(message)
        } catch (error) {
          console.warn("[herb-client] failed to parse message:", error)
        }
      }

      this.socket.onclose = () => {
        console.debug("[herb-client] disconnected from dev server")
        this.options.onDisconnect?.()
        this.scheduleReconnect()
      }

      this.socket.onerror = () => {
        try {
          this.socket?.close()
        } catch {
          this.scheduleReconnect()
        }
      }
    } catch {
      this.scheduleReconnect()
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.debug("[herb-client] gave up reconnecting after %d attempts", this.reconnectAttempts)
      this.givenUp = true
      this.options.onGivenUp?.()
      return
    }

    this.reconnectAttempts++

    const delay = Math.min(
      this.reconnectInterval * Math.pow(1.5, this.reconnectAttempts - 1),
      10000
    )

    this.options.onReconnecting?.(this.reconnectAttempts, this.maxReconnectAttempts, delay)

    this.reconnectTimer = setTimeout(() => {
      this.attemptConnect()
    }, delay)
  }
}
