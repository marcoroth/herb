import type { HerbClient } from "./client"

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

    const state = this.client.getState()

    switch (state) {
      case "connected":
        this.setDotStyle(dot, "#22c55e", true, true)
        dot.style.cursor = "default"
        dot.title = "Connected to herb dev server"
        dot.onclick = null

        if (panelDot) this.setDotStyle(panelDot, "#22c55e", false, false)
        if (panelStatus) { panelStatus.textContent = `Dev Server connected (port ${this.client.getPort()})`; panelStatus.style.color = "#059669" }
        if (panelRetry) panelRetry.style.display = "none"
        break

      case "disconnected":
        this.setDotStyle(dot, "#ef4444", false, false)
        dot.style.cursor = "default"
        dot.title = "Disconnected from herb dev server"
        dot.onclick = null

        if (panelDot) this.setDotStyle(panelDot, "#ef4444", false, false)
        if (panelStatus) { panelStatus.textContent = "Dev Server disconnected"; panelStatus.style.color = "#6b7280" }
        if (panelRetry) { panelRetry.style.display = "block"; panelRetry.onclick = (e) => { e.stopPropagation(); this.client.retry() } }
        break

      case "gave-up":
        this.setDotStyle(dot, "#f59e0b", false, false)
        dot.style.cursor = "pointer"
        dot.title = "Connection to herb dev server failed — click to retry"
        dot.onclick = (e) => { e.stopPropagation(); this.client.retry() }

        if (panelDot) this.setDotStyle(panelDot, "#f59e0b", false, false)
        if (panelStatus) { panelStatus.textContent = "Dev Server not available"; panelStatus.style.color = "#d97706" }
        if (panelRetry) { panelRetry.style.display = "block"; panelRetry.onclick = (e) => { e.stopPropagation(); this.client.retry() } }
        break
    }
  }

  updateReconnectCountdown(attempt: number, maxAttempts: number, delay: number): void {
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

  private setDotStyle(element: HTMLElement, background: string, glow: boolean, pulse: boolean): void {
    element.style.background = background
    element.style.boxShadow = glow ? "0 0 4px rgba(34, 197, 94, 0.5)" : "none"
    element.style.animation = pulse ? "herb-dot-pulse 2s ease-in-out infinite" : "none"
  }
}
