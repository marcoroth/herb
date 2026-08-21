/**
 * Static understanding of the vocabulary this runtime executes: the `herb:state` and
 * `herb:slots` comment directives, and the `data-herb-*` action attribute grammar.
 *
 * This entry exists for tooling, the linter and the dev tools consume it, and it never
 * loads in an application: nothing in the runtime imports this module, so the production
 * entries are unaffected. The clause grammar re-exported here is the exact code
 * `SlotActions` runs, which is what keeps the linter and the runtime from drifting.
 */

export { clauses, names, balancedQuotes, splitOutsideQuotes, unquote } from "./parsing"
export { ACTION_SCHEMA, ACTION_NAMES, HERB_ATTRIBUTES } from "./attributes"

export type { Clause } from "./parsing"
export type { ActionName, ActionSchema, HerbAttribute } from "./attributes"

const STATE_DIRECTIVE_PRESENCE = /^\s*herb:state\b/
const STATE_DIRECTIVE_PATTERN = /^\s*herb:state\s*(\(.*\))\s*$/s
const SLOTS_DIRECTIVE = /^\s*herb:slots\b(.*)$/s
const SLOTS_MODE = /\b(server|client)\b/
const KEYWORD_SEGMENT = /^(\s*)([a-z_][a-zA-Z0-9_]*):(.*)$/s
const BARE_IDENTIFIER = /^[a-z_][a-zA-Z0-9_]*$/

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
  if (!match) return null

  const mode = SLOTS_MODE.exec(match[1])?.[1]

  return mode === "client" ? "client" : "server"
}

export function parseStateDirective(content: string): StateSignature | null {
  const match = STATE_DIRECTIVE_PATTERN.exec(content)

  if (!match) return null

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

  return { signature, signatureOffset, declarations, malformed: null }
}

export function classifyDefault(source: string): StateDefaultKind {
  if (source === "") return "missing"
  if (source === "true" || source === "false") return "boolean"
  if (source === "nil") return "nil"

  if (/^-?\d[\d_]*\.\d/.test(source)) return "float"
  if (/^-?\d[\d_]*$/.test(source)) return "integer"
  if (/^"(?:[^"\\#]|\\.|#(?!\{))*"$/s.test(source)) return "string"
  if (/^'(?:[^'\\]|\\.)*'$/s.test(source)) return "string"
  if (/^:(?:[a-zA-Z_]\w*[?!=]?|"[^"]*"|'[^']*')$/.test(source)) return "symbol"

  if (source.startsWith("[")) return "array"
  if (source.startsWith("{")) return "hash"

  if (BARE_IDENTIFIER.test(source)) return "bare"

  return "seeded"
}

export function mentionsAnyState(source: string, stateNames: readonly string[]): boolean {
  return stateNames.some((name) => new RegExp(`(?<![\\w?])${escapeRegExp(name)}\\??(?![\\w?!])`).test(source))
}

export function bareReadName(expression: string): string | null {
  const source = expression.trim()

  if (!/^[a-z_][a-zA-Z0-9_]*\??$/.test(source)) return null

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

    if (character === "(" || character === "[" || character === "{") depth += 1
    if (character === ")" || character === "]" || character === "}") depth -= 1

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

    if (content[cursor] === quote) return cursor + 1

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

    if (character === "(" || character === "[" || character === "{") depth += 1

    if (character === ")" || character === "]" || character === "}") {
      depth -= 1

      if (depth < 0) return false
    }

    index += 1
  }

  return depth === 0
}

function escapeRegExp(source: string): string {
  return source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
