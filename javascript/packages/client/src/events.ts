export const SLOT_EVENT = "herb:slot-update"
export const STATE_EVENT = "herb:state-change"

export const DIRECT_EVENTS = ["mouseenter", "mouseleave"]

const DEFAULT_EVENTS: Record<string, string> = {
  form: "submit",
  input: "input",
  textarea: "input",
  select: "change",
  details: "toggle",
}

export function defaultEventFor(element: Element): string {
  if (element instanceof HTMLInputElement && ["submit", "button", "reset"].includes(element.type)) {
    return "click"
  }

  return DEFAULT_EVENTS[element.localName] ?? "click"
}
