export interface EventSpec {
  type: string
  key: string | null
  modifiers: string[]
  global: boolean
  outside: boolean
}

export const DIRECT_EVENTS = ["mouseenter", "mouseleave"]
export const CLICK_INPUT_TYPES = ["submit", "button", "reset"]

const MODIFIERS = ["meta", "ctrl", "alt", "shift"] as const
const KEY_EVENTS = ["keydown", "keyup", "keypress"]

const PRINTABLE_ASCII = /^[ -~]$/
const LAYOUT_KEYS = /^(?:Key([A-Z])|Digit([0-9]))$/

const DEFAULT_EVENTS: Record<string, string> = {
  form: "submit",
  input: "input",
  textarea: "input",
  select: "change",
  details: "toggle",
}

const KEY_ALIASES: Record<string, string> = {
  esc: "escape",
  return: "enter",
  space: " ",
  up: "arrowup",
  down: "arrowdown",
  left: "arrowleft",
  right: "arrowright",
  page_up: "pageup",
  page_down: "pagedown",
}

const MODIFIER_ALIASES: Record<string, string> = {
  meta: "meta",
  cmd: "meta",
  ctrl: "ctrl",
  alt: "alt",
  shift: "shift",
}

export function defaultEventFor(element: Element): string {
  if (element instanceof HTMLInputElement && CLICK_INPUT_TYPES.includes(element.type)) {
    return "click"
  }

  return DEFAULT_EVENTS[element.localName] ?? "click"
}

export function parseEventSpec(event: string): EventSpec {
  const [scoped, target] = event.split("@", 2)
  const { head, filter } = splitKeyFilter(scoped)
  const held = head.split("+")
  const type = held.pop()!

  let key: string | null = null
  const modifiers: string[] = []

  for (const token of [...held, ...filter]) {
    const lowered = token.toLowerCase()
    const modifier = MODIFIER_ALIASES[lowered]

    if (modifier) {
      modifiers.push(modifier)
    } else {
      key = KEY_ALIASES[lowered] ?? lowered
    }
  }

  return {
    type,
    key,
    modifiers,
    global: target === "window" || target === "document" || target === "outside",
    outside: target === "outside",
  }
}

export function eventSpecProblem(event: string): string | null {
  const [scoped, target] = event.split("@", 2)

  if (target !== undefined && target !== "window" && target !== "document" && target !== "outside") {
    return `names \`@${target}\` as its target. Use \`@window\`, \`@document\` or \`@outside\`, or drop the target to listen on the element.`
  }

  const { head, filter } = splitKeyFilter(scoped)
  const held = head.split("+").slice(0, -1)
  const stray = held.find((token) => !MODIFIER_ALIASES[token.toLowerCase()])

  if (stray !== undefined) {
    return `prefixes the event with \`${stray}+\`, which is not a modifier. Use \`ctrl\`, \`alt\`, \`shift\`, \`meta\` or \`cmd\`.`
  }

  if (filter.includes("")) {
    return `has an empty key filter. Name the key after the dot, like \`keydown.esc\`, or drop the dot.`
  }

  const keys = filter.filter((token) => !MODIFIER_ALIASES[token.toLowerCase()])

  if (keys.length > 1) {
    return `filters on ${keys.length} keys. Name one key per clause, with modifiers joined by \`+\`, like \`keydown.ctrl+k\`.`
  }

  if (keys[0]?.includes(".")) {
    return `joins its filter with \`.\`. Join modifiers and key with \`+\`, like \`keydown.meta+k\`.`
  }

  return null
}

function splitKeyFilter(scoped: string): { head: string; filter: string[] } {
  const separator = scoped.indexOf(".")
  const head = separator === -1 ? scoped : scoped.slice(0, separator)

  if (separator === -1 || !KEY_EVENTS.includes(head)) {
    return { head: scoped, filter: [] }
  }

  return { head, filter: scoped.slice(separator + 1).split("+") }
}

export function eventMatches(spec: EventSpec, fired: Event): boolean {
  if (spec.type !== fired.type) {
    return false
  }

  const filtered = spec.key !== null || spec.modifiers.length > 0

  if (filtered && !heldModifiersMatch(spec, fired as KeyboardEvent)) {
    return false
  }

  return spec.key === null || keyMatches(spec.key, fired as KeyboardEvent)
}

function heldModifiersMatch(spec: EventSpec, fired: KeyboardEvent): boolean {
  return MODIFIERS.every((modifier) => Boolean(fired[`${modifier}Key` as "metaKey"]) === spec.modifiers.includes(modifier))
}

function keyMatches(expected: string, fired: KeyboardEvent): boolean {
  if (typeof fired.key !== "string") {
    return false
  }

  if (fired.key.toLowerCase() === expected) {
    return true
  }

  if (fired.isComposing || !PRINTABLE_ASCII.test(expected) || PRINTABLE_ASCII.test(fired.key)) {
    return false
  }

  return typeof fired.code === "string" && keyFromCode(fired.code) === expected
}

function keyFromCode(code: string): string | null {
  const [, letter, digit] = code.match(LAYOUT_KEYS) ?? []

  return letter?.toLowerCase() ?? digit ?? null
}
