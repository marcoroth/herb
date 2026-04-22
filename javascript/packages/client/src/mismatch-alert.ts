import { colors } from "./colors"

const ALERT_ID = "herbProjectMismatchAlert"

export class MismatchAlert {
  static show(serverProject: string, clientProject: string): void {
    if (document.getElementById(ALERT_ID)) return

    const serverName = serverProject.split("/").pop() ?? serverProject
    const clientName = clientProject.split("/").pop() ?? clientProject

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
    title.textContent = "Herb Dev Server mismatch"

    const description = document.createElement("div")
    description.style.cssText = `font-size:12px;color:${colors.grayLighter};`
    description.textContent = `The dev server is watching ${serverName} but this page is from ${clientName}. Messages will be ignored.`

    content.appendChild(title)
    content.appendChild(description)

    const dismiss = document.createElement("button")
    dismiss.style.cssText = `background:none;border:none;cursor:pointer;font-size:16px;color:${colors.amberDark};padding:0;line-height:1;`
    dismiss.textContent = "\u2715"
    dismiss.addEventListener("click", () => alert.remove())

    alert.appendChild(iconElement)
    alert.appendChild(content)
    alert.appendChild(dismiss)
    document.body.appendChild(alert)

    const panelStatus = document.getElementById("herbDevServerStatus")
    const panelDot = document.getElementById("herbDevServerDot")

    if (panelStatus) {
      panelStatus.textContent = `Wrong project (${serverName})`
      panelStatus.style.color = colors.amberDarker
    }

    if (panelDot) {
      panelDot.style.background = colors.amber
    }
  }
}
