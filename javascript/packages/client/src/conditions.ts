export type ConditionValue = string | number | boolean | null
export type ConditionalArm = Arm | ComboArm | [string, StateComparand, number | null] | [string, StateComparand, number | null, string]
export type StateComparand = null | { state: string } | { value: ConditionValue } | string
export type StateCondition = [string, StateComparand] | [string, StateComparand, string] | ComboCondition

export type ValueOf = (name: string) => ConditionValue

export interface ComboCondition {
  all?: StateCondition[]
  any?: StateCondition[]
}

export interface Arm {
  branch: number | null
  condition: StateCondition
}

export interface ComboArm extends ComboCondition {
  branch: number | null
}

export interface Conditional {
  arms: ConditionalArm[]
  else: number | null
}

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

  const [name, comparand, operator] = condition
  const value = valueOf(name)

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
    case ">": return value > against
    case ">=": return value >= against
    case "<": return value < against
    case "<=": return value <= against
    default: return false
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

export function names(condition: StateCondition): string[] {
  if (!Array.isArray(condition)) {
    return parts(condition).flatMap((part) => names(part))
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
