const TOAST_DURATION = 3000
const TOAST_FADE_DURATION = 300
const TOAST_ID = "herbDevServerToast"

type ToastType = "connected" | "disconnected" | "warning"

const TOAST_STYLES: Record<ToastType, { background: string; border: string; text: string; icon: string }> = {
  connected: { background: "#ecfdf5", border: "#10b981", text: "#065f46", icon: "\u{1F7E2}" },
  disconnected: { background: "#fef2f2", border: "#ef4444", text: "#991b1b", icon: "\u{1F534}" },
  warning: { background: "#fffbeb", border: "#f59e0b", text: "#92400e", icon: "\u{1F7E1}" },
}

export class Toast {
  static show(message: string, type: ToastType): void {
    document.getElementById(TOAST_ID)?.remove()

    const style = TOAST_STYLES[type]

    const toast = document.createElement("div")
    toast.id = TOAST_ID
    toast.style.cssText = `position:fixed;top:36px;right:10px;z-index:999997;background:${style.background};border:1px solid ${style.border};border-radius:8px;padding:8px 14px;font-family:system-ui,sans-serif;font-size:12px;color:${style.text};box-shadow:0 4px 12px rgba(0,0,0,0.1);display:flex;align-items:center;gap:8px;transition:opacity 0.3s ease;`

    const icon = document.createElement("span")
    icon.textContent = style.icon

    const text = document.createElement("span")
    text.textContent = message

    toast.appendChild(icon)
    toast.appendChild(text)
    document.body.appendChild(toast)

    setTimeout(() => {
      toast.style.opacity = "0"
      setTimeout(() => toast.remove(), TOAST_FADE_DURATION)
    }, TOAST_DURATION)
  }
}
