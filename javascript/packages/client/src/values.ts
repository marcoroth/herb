export type StateValue = string | number | boolean | null
export type StateKind = "boolean" | "integer" | "string" | "symbol" | "nil" | "seeded"

export function printValue(value: StateValue): string {
  if (value === null) {
    return ""
  }

  if (value === true) {
    return "true"
  }

  if (value === false) {
    return "false"
  }

  return String(value)
}

export function coerceState(text: string, kind: StateKind): StateValue {
  if (kind === "boolean") {
    return text === "true"
  }

  if (kind === "integer") {
    const trimmed = text.trim()

    if (!/^-?\d+$/.test(trimmed)) {
      return 0
    }

    return Number(trimmed)
  }

  if (kind === "nil") {
    if (text === "") {
      return null
    }

    return text
  }

  return text
}

export function boundValue(element: Element, kind: StateKind): StateValue {
  if (element instanceof HTMLInputElement && element.type === "checkbox") {
    return element.checked
  }

  const raw = (element as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value

  return coerceState(raw, kind)
}

export function coerceSeed(shipped: unknown, kind: StateKind): StateValue | undefined {
  if (shipped !== null && typeof shipped !== "boolean" && typeof shipped !== "number" && typeof shipped !== "string") {
    return undefined
  }

  switch (kind) {
    case "boolean":
      if (typeof shipped === "boolean") {
        return shipped
      }

      return shipped !== null
    case "integer":
      if (typeof shipped === "number") {
        if (Number.isInteger(shipped)) {
          return shipped
        }

        return Math.trunc(shipped)
      }

      if (typeof shipped === "string" && /^-?\d+$/.test(shipped.trim())) {
        return Number(shipped.trim())
      }

      return undefined
    case "string":
    case "symbol":
      if (typeof shipped === "string") {
        return shipped
      }

      if (typeof shipped === "number" || typeof shipped === "boolean") {
        return String(shipped)
      }

      return undefined
    default:
      return shipped
  }
}

export function kindArticle(kind: StateKind): string {
  if (kind === "integer") {
    return "an Integer"
  }

  return `a ${kind.charAt(0).toUpperCase() + kind.slice(1)}`
}
