/**
 * Static understanding of the vocabulary this runtime executes: the `herb:state` and
 * `herb:slots` comment directives, and the `data-herb-*` action attribute grammar.
 *
 * This entry exists for tooling, the linter and the language service consume it, and it never
 * loads in an application: nothing in the runtime imports this module, so the production
 * entries are unaffected. The clause grammar re-exported here is the exact code
 * `Actions` runs, which is what keeps the linter and the runtime from drifting.
 */

export { ACTION_SCHEMA, ACTION_NAMES, HERB_ATTRIBUTES } from "./grammar/attributes"
export { clauses, names, balancedQuotes, splitOutsideQuotes, unquote } from "./grammar/parsing"

export type { Clause } from "./grammar/parsing"
export type { ActionName, ActionSchema, HerbAttribute } from "./grammar/attributes"

const SLOTS_MODE = /\b(server|client)\b/
const SLOTS_DIRECTIVE = /^\s*herb:slots\b(.*)$/s
const STATE_DIRECTIVE_PRESENCE = /^\s*herb:state\b/
const STATE_DIRECTIVE_PATTERN = /^\s*herb:state\s*(\(.*\))\s*$/s
const BARE_IDENTIFIER = /^[a-z_][a-zA-Z0-9_]*$/
const KEYWORD_SEGMENT = /^(\s*)([a-z_][a-zA-Z0-9_]*):(.*)$/s

export type StateDefaultKind =
  | "boolean"
  | "integer"
  | "string"
  | "symbol"
  | "nil"
  | "float"
  | "array"
  | "hash"
  | "bare"
  | "seeded"
  | "missing"

export interface StateDeclaration {
  name: string
  nameOffset: number
  defaultSource: string
  defaultOffset: number
  kind: StateDefaultKind
  derived?: DerivedDefault | "mixed" | "forward" | null
}

export interface StateSignature {
  signature: string
  signatureOffset: number
  declarations: StateDeclaration[]
  malformed: "unparseable" | "not-keywords" | null
}

export function isStateDirectiveContent(content: string): boolean {
  return STATE_DIRECTIVE_PRESENCE.test(content)
}

export function slotsDirectiveModeOf(content: string): "server" | "client" | null {
  const match = SLOTS_DIRECTIVE.exec(content)

  if (!match) {
    return null
  }

  const mode = SLOTS_MODE.exec(match[1])?.[1]

  return mode === "client" ? "client" : "server"
}

export function parseStateDirective(content: string): StateSignature | null {
  const match = STATE_DIRECTIVE_PATTERN.exec(content)

  if (!match) {
    return null
  }

  const signature = match[1]
  const signatureOffset = content.indexOf(signature)

  return parseStateSignature(signature, signatureOffset)
}

function parseStateSignature(signature: string, signatureOffset: number): StateSignature {
  const inner = signature.slice(1, -1)

  if (!signature.endsWith(")") || !balanced(inner)) {
    return { signature, signatureOffset, declarations: [], malformed: "unparseable" }
  }

  if (inner.trim() === "") {
    return { signature, signatureOffset, declarations: [], malformed: "not-keywords" }
  }

  const declarations: StateDeclaration[] = []

  for (const segment of topLevelSegments(inner)) {
    const keyword = KEYWORD_SEGMENT.exec(segment.text)

    if (!keyword) {
      return { signature, signatureOffset, declarations: [], malformed: "not-keywords" }
    }

    const [, leading, name, rawDefault] = keyword
    const defaultSource = rawDefault.trim()
    const defaultOffset = rawDefault.length === 0 ? segment.text.length : segment.text.length - rawDefault.length + rawDefault.indexOf(defaultSource)

    declarations.push({
      name,
      nameOffset: signatureOffset + 1 + segment.start + leading.length,
      defaultSource,
      defaultOffset: signatureOffset + 1 + segment.start + defaultOffset,
      kind: classifyDefault(defaultSource),
    })
  }

  const names = declarations.map((declaration) => declaration.name)
  const resolved = new Map<string, string>()

  for (const [index, declaration] of declarations.entries()) {
    if (declaration.kind === "bare" || declaration.kind === "seeded") {
      const outcome = classifyDerivedDefault(declaration.defaultSource, resolved)

      if (outcome === null) {
        declaration.derived = mentionsAnyState(declaration.defaultSource, names.slice(index + 1)) ? "forward" : null
      } else {
        declaration.derived = outcome
      }
    } else {
      declaration.derived = null
    }

    const kind = declaration.derived !== null && typeof declaration.derived === "object" ? declaration.derived.kind : declaration.kind

    resolved.set(declaration.name, kind)
  }

  return { signature, signatureOffset, declarations, malformed: null }
}

export function classifyDefault(source: string): StateDefaultKind {
  if (source === "") {
    return "missing"
  }

  if (source === "true" || source === "false") {
    return "boolean"
  }

  if (source === "nil") {
    return "nil"
  }

  if (/^-?\d[\d_]*\.\d/.test(source)) {
    return "float"
  }

  if (/^-?\d[\d_]*$/.test(source)) {
    return "integer"
  }

  if (/^"(?:[^"\\#]|\\.|#(?!\{))*"$/s.test(source)) {
    return "string"
  }

  if (/^'(?:[^'\\]|\\.)*'$/s.test(source)) {
    return "string"
  }

  if (/^:(?:[a-zA-Z_]\w*[?!=]?|"[^"]*"|'[^']*')$/.test(source)) {
    return "symbol"
  }

  if (source.startsWith("[")) {
    return "array"
  }

  if (source.startsWith("{")) {
    return "hash"
  }

  if (BARE_IDENTIFIER.test(source)) {
    return "bare"
  }

  return "seeded"
}

export type DerivedComparand = string | null | { state: string }

export type DerivedCondition =
  | [string, DerivedComparand]
  | [string, DerivedComparand, string]
  | { all?: DerivedCondition[]; any?: DerivedCondition[] }

export interface DerivedDefault {
  kind: "boolean" | "integer" | "string" | "symbol" | "nil" | "seeded"
  condition: DerivedCondition
  sources: string[]
}

const MIRRORED_COMPARISONS: Record<string, string> = { ">": "<", ">=": "<=", "<": ">", "<=": ">=" }
const LITERAL_DEFAULT_KINDS = new Set(["boolean", "integer", "string", "symbol", "nil"])

export function classifyDerivedDefault(source: string, declared: ReadonlyMap<string, string>): DerivedDefault | "mixed" | null {
  const parsed = parseDerivedCondition(source.trim(), declared)

  if (parsed === null && mentionsAnyState(source, [...declared.keys()])) {
    return "mixed"
  }

  return parsed
}

function parseDerivedCondition(source: string, declared: ReadonlyMap<string, string>): DerivedDefault | "mixed" | null {
  const trimmed = unwrapParentheses(source.trim())

  for (const [operator, key] of [["||", "any"], ["&&", "all"]] as const) {
    const parts = splitTopLevelOperator(trimmed, operator)

    if (parts.length > 1) {
      const conditions: DerivedCondition[] = []
      const sources: string[] = []

      for (const part of parts) {
        const parsed = parseDerivedCondition(part, declared)

        if (parsed === null || parsed === "mixed") {
          return parsed === "mixed" ? "mixed" : null
        }

        conditions.push(parsed.condition)
        sources.push(...parsed.sources)
      }

      return { kind: "boolean", condition: { [key]: conditions }, sources: [...new Set(sources)] }
    }
  }

  const comparison = splitTopLevelComparison(trimmed)

  if (comparison) {
    const [left, operator, right] = comparison
    const leftState = derivedStateSide(left, declared)
    const rightState = derivedStateSide(right, declared)

    if (leftState && rightState) {
      const spelled = operator === "==" ? undefined : operator
      const condition: DerivedCondition = spelled ? [leftState, { state: rightState }, spelled] : [leftState, { state: rightState }]

      return { kind: "boolean", condition, sources: [...new Set([leftState, rightState])] }
    }

    const state = leftState ?? rightState

    if (!state) {
      return null
    }

    const literal = (leftState ? right : left).trim()

    if (!LITERAL_DEFAULT_KINDS.has(classifyDefault(literal))) {
      return null
    }

    let spelled = operator === "==" ? undefined : operator

    if (spelled && rightState && spelled !== "!=") {
      spelled = MIRRORED_COMPARISONS[spelled]
    }

    const condition: DerivedCondition = spelled ? [state, literal, spelled] : [state, literal]

    return { kind: "boolean", condition, sources: [state] }
  }

  const bare = bareReadName(trimmed)

  if (bare === null) {
    return null
  }

  const kind = declared.get(bare)

  if (kind === undefined) {
    return null
  }

  if (trimmed.endsWith("?")) {
    return kind === "boolean" || kind === "seeded" || kind === "bare"
      ? { kind: "boolean", condition: [bare, null], sources: [bare] }
      : "mixed"
  }

  const resolved = LITERAL_DEFAULT_KINDS.has(kind) ? kind as DerivedDefault["kind"] : "seeded"

  return { kind: resolved, condition: [bare, null], sources: [bare] }
}

function derivedStateSide(side: string, declared: ReadonlyMap<string, string>): string | null {
  const bare = bareReadName(side.trim())

  if (bare === null || !declared.has(bare)) {
    return null
  }

  return bare
}

function unwrapParentheses(source: string): string {
  let current = source

  while (current.startsWith("(") && current.endsWith(")") && balanced(current.slice(1, -1))) {
    current = current.slice(1, -1).trim()
  }

  return current
}

function splitTopLevelOperator(source: string, operator: "||" | "&&"): string[] {
  const parts: string[] = []
  let depth = 0
  let start = 0

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]

    if (character === '"' || character === "'") {
      index = skipString(source, index) - 1

      continue
    }

    if (character === "(" || character === "[" || character === "{") {
      depth += 1
    } else if (character === ")" || character === "]" || character === "}") {
      depth -= 1
    } else if (depth === 0 && character === operator[0] && source[index + 1] === operator[1]) {
      parts.push(source.slice(start, index).trim())
      index += 1
      start = index + 1
    }
  }

  parts.push(source.slice(start).trim())

  return parts
}

function splitTopLevelComparison(source: string): [string, string, string] | null {
  let depth = 0

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]

    if (character === '"' || character === "'") {
      index = skipString(source, index) - 1

      continue
    }

    if (character === "(" || character === "[" || character === "{") {
      depth += 1
    } else if (character === ")" || character === "]" || character === "}") {
      depth -= 1
    } else if (depth === 0) {
      for (const operator of ["==", "!=", ">=", "<=", ">", "<"]) {
        if (!source.startsWith(operator, index)) {
          continue
        }

        if (operator === "<" && source[index + 1] === "<") {
          break
        }

        if (operator === ">" && source[index + 1] === ">") {
          break
        }

        return [source.slice(0, index), operator, source.slice(index + operator.length)]
      }
    }
  }

  return null
}

export function mentionsAnyState(source: string, stateNames: readonly string[]): boolean {
  return stateNames.some((name) => new RegExp(`(?<![\\w?])${escapeRegExp(name)}\\??(?![\\w?!])`).test(source))
}

export function bareReadName(expression: string): string | null {
  const source = expression.trim()

  if (!/^[a-z_][a-zA-Z0-9_]*\??$/.test(source)) {
    return null
  }

  return source.endsWith("?") ? source.slice(0, -1) : source
}

interface Segment {
  text: string
  start: number
}

function topLevelSegments(inner: string): Segment[] {
  const segments: Segment[] = []
  let depth = 0
  let start = 0
  let index = 0

  while (index < inner.length) {
    const character = inner[index]

    if (character === '"' || character === "'") {
      index = skipString(inner, index)

      continue
    }

    if (character === "(" || character === "[" || character === "{") {
      depth += 1
    }

    if (character === ")" || character === "]" || character === "}") {
      depth -= 1
    }

    if (character === "," && depth === 0) {
      segments.push({ text: inner.slice(start, index), start })
      start = index + 1
    }

    index += 1
  }

  segments.push({ text: inner.slice(start), start })

  return segments
}

function skipString(content: string, index: number): number {
  const quote = content[index]
  let cursor = index + 1

  while (cursor < content.length) {
    if (content[cursor] === "\\") {
      cursor += 2

      continue
    }

    if (content[cursor] === quote) {
      return cursor + 1
    }

    cursor += 1
  }

  return cursor
}

function balanced(inner: string): boolean {
  let depth = 0
  let index = 0

  while (index < inner.length) {
    const character = inner[index]

    if (character === '"' || character === "'") {
      index = skipString(inner, index)

      continue
    }

    if (character === "(" || character === "[" || character === "{") {
      depth += 1
    }

    if (character === ")" || character === "]" || character === "}") {
      depth -= 1

      if (depth < 0) {
        return false
      }
    }

    index += 1
  }

  return depth === 0
}

function escapeRegExp(source: string): string {
  return source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
