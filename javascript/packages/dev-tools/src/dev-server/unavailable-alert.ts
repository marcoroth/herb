import { colors } from "./colors"
import { DEV_SERVER_COMMAND } from "./types"

const ALERT_ID = "herbDevServerUnavailableAlert"

export interface UnavailableAlertOptions {
  port: number
  onRetry: () => void
}

export class UnavailableAlert {
  private static dismissed = false

  static show(options: UnavailableAlertOptions): void {
    if (this.dismissed) return
    if (document.getElementById(ALERT_ID)) return

    const alert = document.createElement("div")
    alert.id = ALERT_ID
    alert.style.cssText = `position:fixed;top:32px;right:10px;z-index:999998;background:${colors.amberLight};border:1px solid ${colors.amber};border-radius:8px;padding:12px 16px;max-width:320px;font-family:system-ui,sans-serif;font-size:13px;color:${colors.amberDark};box-shadow:0 4px 12px rgba(0,0,0,0.1);display:flex;gap:10px;align-items:flex-start;`

    const iconElement = document.createElement("span")
    iconElement.style.cssText = "font-size:18px;line-height:1;"
    iconElement.textContent = "\u26A0\uFE0F"

    const content = document.createElement("div")
    content.style.flex = "1"

    const title = document.createElement("div")
    title.style.cssText = "font-weight:600;margin-bottom:4px;"
    title.textContent = "Herb Dev Server not available"

    const description = document.createElement("div")
    description.style.cssText = `font-size:12px;color:${colors.grayLighter};`
    description.textContent = `Nothing is listening on port ${options.port}. Make sure the Herb dev server is running:`

    const command = document.createElement("code")
    command.style.cssText = `display:block;margin-top:6px;padding:5px 8px;border-radius:6px;background:rgba(146,64,14,0.08);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;color:${colors.amberDark};user-select:all;`
    command.textContent = DEV_SERVER_COMMAND

    const retry = document.createElement("button")
    retry.style.cssText = `margin-top:8px;background:none;border:1px solid ${colors.amber};border-radius:6px;cursor:pointer;font-family:inherit;font-size:12px;color:${colors.amberDark};padding:3px 10px;`
    retry.textContent = "Retry"
    retry.addEventListener("click", () => {
      this.hide()
      options.onRetry()
    })

    content.appendChild(title)
    content.appendChild(description)
    content.appendChild(command)
    content.appendChild(retry)

    const dismiss = document.createElement("button")
    dismiss.style.cssText = `background:none;border:none;cursor:pointer;font-size:16px;color:${colors.amberDark};padding:0;line-height:1;`
    dismiss.textContent = "\u2715"
    dismiss.addEventListener("click", () => {
      this.dismissed = true
      this.hide()
    })

    alert.appendChild(iconElement)
    alert.appendChild(content)
    alert.appendChild(dismiss)
    document.body.appendChild(alert)
  }

  static hide(): void {
    document.getElementById(ALERT_ID)?.remove()
  }

  static reset(): void {
    this.dismissed = false
    this.hide()
  }
}
