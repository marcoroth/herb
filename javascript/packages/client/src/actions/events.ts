export const DIRECT_EVENTS = ["mouseenter", "mouseleave"]
export const CLICK_INPUT_TYPES = ["submit", "button", "reset"]

const DEFAULT_EVENTS: Record<string, string> = {
  form: "submit",
  input: "input",
  textarea: "input",
  select: "change",
  details: "toggle",
}

export function defaultEventFor(element: Element): string {
  if (element instanceof HTMLInputElement && CLICK_INPUT_TYPES.includes(element.type)) {
    return "click"
  }

  return DEFAULT_EVENTS[element.localName] ?? "click"
}
