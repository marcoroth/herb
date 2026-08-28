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

    const panelDot = this.all("[data-herb-dev-server-dot]")
    const panelStatus = this.all("[data-herb-dev-server-status]")
    const panelRetry = this.all("[data-herb-dev-server-retry]") as HTMLButtonElement[]

    if (!dot && panelDot.length === 0 && panelStatus.length === 0) return
    const retryHandler = (e: MouseEvent) => { e.stopPropagation(); this.client.retry() }

    const state = this.client.getState()

    switch (state) {
      case "connected":
        this.applyBadge(dot, colors.green, "Connected to herb dev server", true, true, "default", null)

        this.updatePanel(panelDot, panelStatus, panelRetry, {
          dotColor: colors.green,
          statusText: `Dev Server connected (port ${this.client.getPort()})`,
          statusColor: colors.greenDark,
          retryVisible: false,
        })

        break

      case "disconnected":
        this.applyBadge(dot, colors.red, "Disconnected from herb dev server", false, false, "default", null)

        this.updatePanel(panelDot, panelStatus, panelRetry, {
          dotColor: colors.red,
          statusText: "Dev Server disconnected",
          statusColor: colors.gray,
          retryVisible: true,
          retryHandler,
        })

        break

      case "given-up":
        this.applyBadge(dot, colors.amber, "Connection to herb dev server failed — click to retry", false, false, "pointer", retryHandler)

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
    const panelStatus = this.all("[data-herb-dev-server-status]")
    if (panelStatus.length === 0) return

    if (this.reconnectCountdown) {
      clearInterval(this.reconnectCountdown)
      this.reconnectCountdown = null
    }

    let remaining = Math.ceil(delay / 1000)
    this.write(panelStatus, `Retry ${attempt}/${maxAttempts} in ${remaining}s`, colors.gray)

    this.reconnectCountdown = setInterval(() => {
      remaining--

      if (remaining <= 0) {
        if (this.reconnectCountdown) {
          clearInterval(this.reconnectCountdown)
          this.reconnectCountdown = null
        }

        this.write(panelStatus, `Retry ${attempt}/${maxAttempts} connecting...`, colors.gray)

        return
      }

      this.write(panelStatus, `Retry ${attempt}/${maxAttempts} in ${remaining}s`, colors.gray)
    }, 1000)
  }

  private all(selector: string): HTMLElement[] {
    return Array.from(document.querySelectorAll<HTMLElement>(selector))
  }

  private write(elements: HTMLElement[], text: string, color: string): void {
    for (const element of elements) {
      element.textContent = text
      element.style.color = color
    }
  }

  private applyBadge(
    dot: HTMLElement | null,
    color: string,
    title: string,
    glow: boolean,
    pulse: boolean,
    cursor: string,
    handler: ((e: MouseEvent) => void) | null
  ): void {
    if (!dot) return

    this.setDotStyle(dot, color, glow, pulse)
    dot.style.cursor = cursor
    dot.title = title
    dot.onclick = handler
  }

  private updatePanel(
    panelDot: HTMLElement[],
    panelStatus: HTMLElement[],
    panelRetry: HTMLButtonElement[],
    options: {
      dotColor: string
      statusText: string
      statusColor: string
      retryVisible: boolean
      retryHandler?: (e: MouseEvent) => void
    }
  ): void {
    for (const element of panelDot) this.setDotStyle(element, options.dotColor, false, false)

    this.write(panelStatus, options.statusText, options.statusColor)

    for (const element of panelRetry) {
      element.style.display = options.retryVisible ? "block" : "none"

      if (options.retryHandler) {
        element.onclick = options.retryHandler
      }
    }
  }

  private setDotStyle(element: HTMLElement, background: string, glow: boolean, pulse: boolean): void {
    element.style.background = background
    element.style.boxShadow = glow ? colors.greenGlow : "none"
    element.style.animation = pulse ? "herb-dot-pulse 2s ease-in-out infinite" : "none"
  }
}
