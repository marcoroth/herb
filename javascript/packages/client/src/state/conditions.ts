import type { Arm, ComboCondition, ConditionValue, ConditionalArm, StateComparand, StateCondition, ValueOf } from "./types"

export function armOf(arm: ConditionalArm): Arm {
  if (Array.isArray(arm)) {
    const [name, comparand, branch, operator] = arm

    if (operator === undefined) {
      return { branch, condition: [name, comparand] }
    }

    return { branch, condition: [name, comparand, operator] }
  }

  if ("condition" in arm) {
    return arm
  }

  const { branch, ...combo } = arm

  return { branch, condition: combo }
}

export function matches(condition: StateCondition, valueOf: ValueOf): boolean {
  if (!Array.isArray(condition)) {
    if (condition.all) {
      return condition.all.every((part) => matches(part, valueOf))
    }

    return parts(condition).some((part) => matches(part, valueOf))
  }

  const [name, comparand, operator, transform] = condition
  const value = typeof transform === "string" ? transformed(transform, valueOf(name)) : valueOf(name)

  if (operator === "blank") {
    return blank(value)
  }

  if (operator === "present") {
    return !blank(value)
  }

  if (operator === "falsy") {
    return !truthy(value)
  }

  if (comparand === null) {
    return truthy(value)
  }

  const against = comparandValue(comparand, valueOf)

  if (operator === undefined || operator === "==") {
    return value === against
  }

  if (operator === "!=") {
    return value !== against
  }

  if (typeof value !== "number" || typeof against !== "number") {
    return false
  }

  switch (operator) {
    case ">": {
      return value > against
    }

    case ">=": {
      return value >= against
    }

    case "<": {
      return value < against
    }

    case "<=": {
      return value <= against
    }

    default: {
      return false
    }
  }
}

export function mentions(condition: StateCondition, changed: string[]): boolean {
  if (!Array.isArray(condition)) {
    return parts(condition).some((part) => mentions(part, changed))
  }

  const [name, comparand] = condition

  if (changed.includes(name)) {
    return true
  }

  return typeof comparand === "object" && comparand !== null && "state" in comparand && changed.includes(comparand.state)
}

export function statesIn(condition: StateCondition): string[] {
  if (!Array.isArray(condition)) {
    return parts(condition).flatMap((part) => statesIn(part))
  }

  const [name, comparand] = condition

  if (typeof comparand === "object" && comparand !== null && "state" in comparand) {
    return [name, comparand.state]
  }

  return [name]
}

export function truthy(value: ConditionValue): boolean {
  return value !== false && value !== null
}

export function transformed(operation: string, value: ConditionValue): ConditionValue {
  if (operation === "to_s") {
    return value === null ? "" : String(value)
  }

  if (operation !== "length") {
    return value
  }

  if (typeof value !== "string") {
    return 0
  }

  return [...value].length
}

export function evaluate(condition: StateCondition, valueOf: ValueOf): ConditionValue {
  if (Array.isArray(condition)) {
    const [name, comparand, operator, transform] = condition

    if (typeof transform === "string" && comparand === null && !operator) {
      return transformed(transform, valueOf(name))
    }
  }

  return matches(condition, valueOf)
}

export function blank(value: ConditionValue): boolean {
  if (value === null || value === false) {
    return true
  }

  return typeof value === "string" && /^\s*$/.test(value)
}

export function literal(source: string): ConditionValue | undefined {
  const trimmed = source.trim()

  if (trimmed === "true") {
    return true
  }

  if (trimmed === "false") {
    return false
  }

  if (trimmed === "nil") {
    return null
  }

  if (/^-?\d+$/.test(trimmed)) {
    return Number(trimmed)
  }

  if (/^:[a-zA-Z_]\w*[?!]?$/.test(trimmed)) {
    return trimmed.slice(1)
  }

  if (/^"(?:[^"\\]|\\.)*"$/.test(trimmed) || /^'(?:[^'\\]|\\.)*'$/.test(trimmed)) {
    return trimmed.slice(1, -1).replace(/\\(.)/g, "$1")
  }

  return undefined
}

function comparandValue(comparand: Exclude<StateComparand, null>, valueOf: ValueOf): ConditionValue | undefined {
  if (typeof comparand === "string") {
    return literal(comparand)
  }

  if ("state" in comparand) {
    return valueOf(comparand.state)
  }

  return comparand.value
}

function parts(combo: ComboCondition): StateCondition[] {
  return combo.all ?? combo.any ?? []
}
