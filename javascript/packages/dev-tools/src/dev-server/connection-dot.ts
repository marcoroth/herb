import type { HerbClient } from "./client"
import { colors } from "./colors"

export class ConnectionDot {
  private client: HerbClient
  private reconnectCountdown: ReturnType<typeof setInterval> | null = null

  constructor(client: HerbClient) {
    this.client = client
  }

  apply(): void {
    if (this.reconnectCountdown) {
      clearInterval(this.reconnectCountdown)
      this.reconnectCountdown = null
    }

    const dot = document.getElementById("herbConnectionDot")
    if (!dot) return

    const panelDot = document.getElementById("herbDevServerDot")
    const panelStatus = document.getElementById("herbDevServerStatus")
    const panelRetry = document.getElementById("herbDevServerRetry") as HTMLButtonElement | null
    const retryHandler = (e: MouseEvent) => { e.stopPropagation(); this.client.retry() }

    const state = this.client.getState()

    switch (state) {
      case "connected":
        this.setDotStyle(dot, colors.green, true, true)
        dot.style.cursor = "default"
        dot.title = "Connected to herb dev server"
        dot.onclick = null

        this.updatePanel(panelDot, panelStatus, panelRetry, {
          dotColor: colors.green,
          statusText: `Dev Server connected (port ${this.client.getPort()})`,
          statusColor: colors.greenDark,
          retryVisible: false,
        })

        break

      case "disconnected":
        this.setDotStyle(dot, colors.red, false, false)
        dot.style.cursor = "default"
        dot.title = "Disconnected from herb dev server"
        dot.onclick = null

        this.updatePanel(panelDot, panelStatus, panelRetry, {
          dotColor: colors.red,
          statusText: "Dev Server disconnected",
          statusColor: colors.gray,
          retryVisible: true,
          retryHandler,
        })

        break

      case "given-up":
        this.setDotStyle(dot, colors.amber, false, false)
        dot.style.cursor = "pointer"
        dot.title = "Connection to herb dev server failed — click to retry"
        dot.onclick = retryHandler

        this.updatePanel(panelDot, panelStatus, panelRetry, {
          dotColor: colors.amber,
          statusText: "Dev Server not available",
          statusColor: colors.amberDarker,
          retryVisible: true,
          retryHandler,
        })

        break
    }
  }

  updateReconnectCountdown(attempt: number, maxAttempts: number, delay: number): void {
    const panelStatus = document.getElementById("herbDevServerStatus")
    if (!panelStatus) return

    if (this.reconnectCountdown) {
      clearInterval(this.reconnectCountdown)
      this.reconnectCountdown = null
    }

    let remaining = Math.ceil(delay / 1000)
    panelStatus.textContent = `Retry ${attempt}/${maxAttempts} in ${remaining}s`
    panelStatus.style.color = colors.gray

    this.reconnectCountdown = setInterval(() => {
      remaining--

      if (remaining <= 0) {
        if (this.reconnectCountdown) {
          clearInterval(this.reconnectCountdown)
          this.reconnectCountdown = null
        }

        panelStatus.textContent = `Retry ${attempt}/${maxAttempts} connecting...`

        return
      }

      panelStatus.textContent = `Retry ${attempt}/${maxAttempts} in ${remaining}s`
    }, 1000)
  }

  private updatePanel(
    panelDot: HTMLElement | null,
    panelStatus: HTMLElement | null,
    panelRetry: HTMLButtonElement | null,
    options: {
      dotColor: string
      statusText: string
      statusColor: string
      retryVisible: boolean
      retryHandler?: (e: MouseEvent) => void
    }
  ): void {
    if (panelDot) this.setDotStyle(panelDot, options.dotColor, false, false)

    if (panelStatus) {
      panelStatus.textContent = options.statusText
      panelStatus.style.color = options.statusColor
    }

    if (panelRetry) {
      panelRetry.style.display = options.retryVisible ? "block" : "none"

      if (options.retryHandler) {
        panelRetry.onclick = options.retryHandler
      }
    }
  }

  private setDotStyle(element: HTMLElement, background: string, glow: boolean, pulse: boolean): void {
    element.style.background = background
    element.style.boxShadow = glow ? colors.greenGlow : "none"
    element.style.animation = pulse ? "herb-dot-pulse 2s ease-in-out infinite" : "none"
  }
}
