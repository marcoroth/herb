import { colors } from "./colors"
import { DEV_SERVER_COMMAND } from "./types"

import type { HerbClient } from "./client"

const CONNECTING_HOLD = 1000

type UpdatePanelOptions = {
  dotColor: string
  statusText: string
  statusColor: string
  retryVisible: boolean
  tipText?: string
  retryHandler?: (e: MouseEvent) => void
  keepStatusWhileRetrying?: boolean
}

export class ConnectionDot {
  private client: HerbClient
  private reconnectCountdown: ReturnType<typeof setInterval> | null = null
  private countdownHold: ReturnType<typeof setTimeout> | null = null
  private connectingSince: number | null = null

  constructor(client: HerbClient) {
    this.client = client
  }

  apply(): void {
    if (this.reconnectCountdown) {
      clearInterval(this.reconnectCountdown)

      this.reconnectCountdown = null
    }

    if (this.countdownHold) {
      clearTimeout(this.countdownHold)

      this.countdownHold = null
    }

    const dot = document.getElementById("herbConnectionDot")
    const panelDot = this.all("[data-herb-dev-server-dot]")
    const panelStatus = this.all("[data-herb-dev-server-status]")
    const panelRetry = this.all<HTMLButtonElement>("[data-herb-dev-server-retry]")

    if (!dot && panelDot.length === 0 && panelStatus.length === 0) {
      return
    }

    const retryHandler = (event: MouseEvent) => {
      event.stopPropagation()

      this.client.retry()
    }

    const state = this.client.getState()

    this.applyHotReloadingAvailability(state === "connected")

    switch (state) {
      case "connected": {
        this.applyBadge(dot, colors.green, "Connected to herb dev server", true, true, "default", null)

        this.updatePanel(panelDot, panelStatus, panelRetry, {
          dotColor: colors.green,
          statusText: `Dev Server connected (port ${this.client.getPort()})`,
          statusColor: colors.greenDark,
          retryVisible: false,
        })

        break
      }

      case "disconnected": {
        this.applyBadge(dot, colors.red, `Disconnected from herb dev server. Make sure it is running with \`${DEV_SERVER_COMMAND}\``, false, false, "default", null)

        this.updatePanel(panelDot, panelStatus, panelRetry, {
          dotColor: colors.red,
          statusText: "Dev Server disconnected",
          statusColor: colors.gray,
          tipText: `Dev Server disconnected. Make sure it is running with \`${DEV_SERVER_COMMAND}\``,
          retryVisible: true,
          retryHandler,
          keepStatusWhileRetrying: true,
        })

        break
      }

      case "given-up": {
        this.applyBadge(dot, colors.amber, `Herb dev server not available. Start it with \`${DEV_SERVER_COMMAND}\`, or click to retry`, false, false, "pointer", retryHandler)

        this.updatePanel(panelDot, panelStatus, panelRetry, {
          dotColor: colors.amber,
          statusText: "Dev Server not available",
          statusColor: colors.amberDarker,
          tipText: `Dev Server not available. Start it with \`${DEV_SERVER_COMMAND}\``,
          retryVisible: true,
          retryHandler,
        })

        break
      }
    }
  }

  updateReconnectCountdown(attempt: number, maxAttempts: number, delay: number): void {
    const panelStatus = this.all("[data-herb-dev-server-status]")

    if (panelStatus.length === 0) {
      return
    }

    if (this.reconnectCountdown) {
      clearInterval(this.reconnectCountdown)

      this.reconnectCountdown = null
    }

    if (this.countdownHold) {
      clearTimeout(this.countdownHold)

      this.countdownHold = null
    }

    const deadline = Date.now() + delay
    let announced = false

    const tick = () => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000))

      if (remaining === 0) {
        if (this.reconnectCountdown) {
          clearInterval(this.reconnectCountdown)
          this.reconnectCountdown = null
        }

        if (!announced) {
          announced = true
          this.connectingSince = Date.now()
        }

        this.write(panelStatus, `Retrying... (${attempt}/${maxAttempts})`, colors.gray)

        return
      }

      this.write(panelStatus, `Retrying in ${remaining}s (${attempt}/${maxAttempts})`, colors.gray)
    }

    const begin = () => {
      this.countdownHold = null

      tick()

      this.reconnectCountdown = setInterval(tick, 200)
    }

    const held = (this.connectingSince === null) ? 0 : Math.max(0, CONNECTING_HOLD - (Date.now() - this.connectingSince))

    if (held === 0) {
      begin()
    } else {
      this.countdownHold = setTimeout(begin, held)
    }
  }

  private all<T extends Element = HTMLElement>(selector: string): T[] {
    return Array.from(document.querySelectorAll<T>(selector))
  }

  private get holdingConnecting(): boolean {
    return this.connectingSince !== null && Date.now() - this.connectingSince < CONNECTING_HOLD
  }

  private write(elements: HTMLElement[], text: string, color: string): void {
    for (const element of elements) {
      element.textContent = text
      element.style.color = color
    }
  }

  private applyBadge(dot: HTMLElement | null, color: string, title: string, glow: boolean, pulse: boolean, cursor: string, handler: ((e: MouseEvent) => void) | null): void {
    if (!dot) return

    this.setDotStyle(dot, color, glow, pulse)

    dot.style.cursor = cursor
    dot.title = title
    dot.onclick = handler
  }

  private applyHotReloadingAvailability(connected: boolean): void {
    const toggle = document.getElementById("herbToggleHotReloading") as HTMLInputElement | null

    if (!toggle) {
      return
    }

    toggle.disabled = !connected
    document.getElementById("herbHotReloadingItem")?.classList.toggle("herb-toggle-item-disabled", !connected)

    const flashes = document.getElementById("herbToggleHotReloadFlashes") as HTMLInputElement | null

    if (flashes) {
      flashes.disabled = !connected
      document.getElementById("herbHotReloadFlashesItem")?.classList.toggle("herb-toggle-item-disabled", !connected)
    }
  }

  private updatePanel(panelDot: HTMLElement[], panelStatus: HTMLElement[], panelRetry: HTMLButtonElement[], options: UpdatePanelOptions): void {
    for (const element of panelDot) {
      this.setDotStyle(element, options.dotColor, false, false)
    }

    if (!(options.keepStatusWhileRetrying && this.holdingConnecting)) {
      this.write(panelStatus, options.statusText, options.statusColor)
    }

    for (const element of panelStatus) {
      element.parentElement?.setAttribute("data-herb-dev-tools-tip", options.tipText ?? options.statusText)
    }

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
