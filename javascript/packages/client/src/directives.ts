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
export { STATE_PREDICATES, STATE_PREDICATE_NAMES } from "./state-predicates"
export { STATE_TRANSFORMS, STATE_TRANSFORM_NAMES } from "./state-transforms"
export { MIRRORED_COMPARISONS, NEGATED_COMPARISONS, ORDERED_COMPARISONS, COMPARISON_OPERATORS } from "./state-operators"
export { STATE_DEFAULT_KINDS, LITERAL_STATE_KINDS, UNKNOWN_STATE_KINDS, FALSY_STATE_KINDS, NILABLE_STATE_KINDS, PRISM_LITERAL_KINDS } from "./state-kinds"

export { stateKindArticle } from "./state-kinds"
export { isMarker, parseMarker } from "./markup/markers"
export { clauses, names, balancedQuotes, splitOutsideQuotes, unquote } from "./grammar/parsing"
export { eventSpecProblem } from "./actions/events"

export type { Clause } from "./grammar/parsing"
export type { StatePredicate } from "./state-predicates"
export type { StateTransform } from "./state-transforms"
export type { StateDefaultKind, StateValueKind } from "./state-kinds"
export type { ActionName, ActionSchema, HerbAttribute } from "./grammar/attributes"
export type { MarkerData, RegionOpenMarker, RegionCloseMarker } from "./markup/markers"

import { STATE_PREDICATES } from "./state-predicates"
import { STATE_TRANSFORMS } from "./state-transforms"
import { MIRRORED_COMPARISONS, NEGATED_COMPARISONS } from "./state-operators"
import { LITERAL_STATE_KINDS, UNKNOWN_STATE_KINDS } from "./state-kinds"

import type { StateDefaultKind } from "./state-kinds"

const SLOTS_MODE = /\b(server|client)\b/
const SLOTS_DIRECTIVE = /^\s*herb:slots\b(.*)$/s
const STATE_DIRECTIVE_PRESENCE = /^\s*herb:state\b/
const STATE_DIRECTIVE_PATTERN = /^\s*herb:state\s*(\(.*\))\s*$/s
const BARE_IDENTIFIER = /^[a-z_][a-zA-Z0-9_]*$/
const KEYWORD_SEGMENT = /^(\s*)([a-z_][a-zA-Z0-9_]*):(.*)$/s

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

  if (/^-?\d[\d_]*(?:\.\d[\d_]*(?:[eE][-+]?\d[\d_]*)?|[eE][-+]?\d[\d_]*)$/.test(source)) {
    return "float"
  }

  if (/^-?(?:\d[\d_]*|0[xX][\da-fA-F][\da-fA-F_]*|0[oO][0-7][0-7_]*|0[bB][01][01_]*|0[dD]\d[\d_]*)$/.test(source)) {
    return "integer"
  }

  if (/^"(?:[^"\\#]|\\.|#(?!\{))*"$/s.test(source)) {
    return "string"
  }

  if (/^'(?:[^'\\]|\\.)*'$/s.test(source)) {
    return "string"
  }

  if (/^\?(?:\\[a-zA-Z0-9\\]|[^\s\\])$/.test(source)) {
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

export type DerivedComparand = string | null | { state: string, transform?: string }

export type DerivedCondition =
  | [string, DerivedComparand]
  | [string, DerivedComparand, string]
  | [string, DerivedComparand, string | null, string]
  | { all?: DerivedCondition[]; any?: DerivedCondition[] }

export interface DerivedDefault {
  kind: "boolean" | "integer" | "string" | "symbol" | "nil" | "seeded"
  condition: DerivedCondition
  sources: string[]
}


export interface PredicateRead {
  name: string
  predicate: string
}

const PREDICATE_READ = /^([a-z_][a-zA-Z0-9_]*)\.([a-z_]+\?)$/
const TRANSFORM_READ = /^([a-z_][a-zA-Z0-9_]*)\.([a-z_]+)$/

export interface TransformRead {
  name: string
  transform: string
}

export function transformReadName(expression: string): TransformRead | null {
  const match = TRANSFORM_READ.exec(expression.trim())

  if (!match || !(match[2] in STATE_TRANSFORMS)) {
    return null
  }

  return { name: match[1], transform: match[2] }
}

export function transformApplies(transform: string, kind: string): boolean {
  const spec = STATE_TRANSFORMS[transform]

  if (!spec || spec.kinds === null || UNKNOWN_STATE_KINDS.has(kind)) {
    return true
  }

  return spec.kinds.includes(kind)
}

export function predicateReadName(expression: string): PredicateRead | null {
  const match = PREDICATE_READ.exec(expression.trim())

  if (!match || !(match[2] in STATE_PREDICATES)) {
    return null
  }

  return { name: match[1], predicate: match[2] }
}

export function predicateAnswers(predicate: string, kind: string): boolean {
  const spec = STATE_PREDICATES[predicate]

  if (!spec || spec.kinds === null || UNKNOWN_STATE_KINDS.has(kind)) {
    return true
  }

  return spec.kinds.includes(kind)
}

export function predicateCondition(read: PredicateRead): DerivedCondition {
  const spec = STATE_PREDICATES[read.predicate]

  if (spec.comparand === undefined) {
    return [read.name, null, spec.operator as string]
  }

  return spec.operator ? [read.name, spec.comparand, spec.operator] : [read.name, spec.comparand]
}

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

  if (trimmed.startsWith("!")) {
    const inner = parseDerivedCondition(unwrapParentheses(trimmed.slice(1).trim()), declared)

    if (inner === null || inner === "mixed") {
      return inner
    }

    const negated = negateCondition(inner.condition)

    return negated === null ? "mixed" : { kind: "boolean", condition: negated, sources: inner.sources }
  }

  const comparison = splitTopLevelComparison(trimmed)

  if (comparison) {
    const [left, operator, right] = comparison
    const leftState = derivedStateSide(left, declared)
    const rightState = derivedStateSide(right, declared)

    if (leftState && rightState) {
      let left = leftState
      let right = rightState
      let mirrored = operator === "==" ? undefined : operator

      if (right.transform && !left.transform) {
        [left, right] = [right, left]

        if (mirrored && mirrored !== "!=") {
          mirrored = MIRRORED_COMPARISONS[mirrored]
        }
      }

      const comparand: DerivedComparand = right.transform ? { state: right.state, transform: right.transform } : { state: right.state }
      const sources = [...new Set([left.state, right.state])]

      if (left.transform) {
        return { kind: "boolean", condition: [left.state, comparand, mirrored ?? "==", left.transform], sources }
      }

      return { kind: "boolean", condition: mirrored ? [left.state, comparand, mirrored] : [left.state, comparand], sources }
    }

    const side = leftState ?? rightState

    if (!side) {
      return null
    }

    const literal = (leftState ? right : left).trim()

    if (!LITERAL_STATE_KINDS.has(classifyDefault(literal))) {
      return null
    }

    let spelled = operator === "==" ? undefined : operator

    if (spelled && rightState && spelled !== "!=") {
      spelled = MIRRORED_COMPARISONS[spelled]
    }

    if (side.transform) {
      return { kind: "boolean", condition: [side.state, literal, spelled ?? "==", side.transform], sources: [side.state] }
    }

    const condition: DerivedCondition = spelled ? [side.state, literal, spelled] : [side.state, literal]

    return { kind: "boolean", condition, sources: [side.state] }
  }

  const transform = transformReadName(trimmed)

  if (transform) {
    const kind = declared.get(transform.name)

    if (kind === undefined) {
      return null
    }

    if (!transformApplies(transform.transform, kind)) {
      return "mixed"
    }

    const spec = STATE_TRANSFORMS[transform.transform]

    return { kind: spec.returns as DerivedDefault["kind"], condition: [transform.name, null, null, spec.operation], sources: [transform.name] }
  }

  const predicate = predicateReadName(trimmed)

  if (predicate) {
    const kind = declared.get(predicate.name)

    if (kind === undefined) {
      return null
    }

    return predicateAnswers(predicate.predicate, kind)
      ? { kind: "boolean", condition: predicateCondition(predicate), sources: [predicate.name] }
      : "mixed"
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
    return { kind: "boolean", condition: [bare, null], sources: [bare] }
  }

  const resolved = LITERAL_STATE_KINDS.has(kind) ? kind as DerivedDefault["kind"] : "seeded"

  return { kind: resolved, condition: [bare, null], sources: [bare] }
}

interface DerivedSide {
  state: string
  transform: string | null
}

const NEGATED_UNARY: Record<string, string> = { blank: "present", present: "blank" }

function negateCondition(condition: DerivedCondition): DerivedCondition | null {
  if (!Array.isArray(condition)) {
    const parts = condition.all ?? condition.any

    if (!parts) {
      return null
    }

    const negated = parts.map((part) => negateCondition(part))

    if (negated.some((part) => part === null)) {
      return null
    }

    return condition.all ? { any: negated as DerivedCondition[] } : { all: negated as DerivedCondition[] }
  }

  const [name, comparand, operator, transform] = condition
  const spelled = typeof operator === "string" ? operator : null

  const flipped =
    spelled === null
      ? (comparand === null ? "falsy" : "!=")
      : spelled === "falsy"
        ? null
        : (NEGATED_UNARY[spelled] ?? NEGATED_COMPARISONS[spelled] ?? null)

  if (spelled !== null && spelled !== "falsy" && flipped === null) {
    return null
  }

  if (typeof transform === "string") {
    return [name, comparand, flipped, transform]
  }

  return flipped === null ? [name, comparand] : [name, comparand, flipped]
}

function derivedStateSide(side: string, declared: ReadonlyMap<string, string>): DerivedSide | null {
  const source = side.trim()
  const bare = bareReadName(source)

  if (bare !== null && declared.has(bare)) {
    return { state: bare, transform: null }
  }

  const transform = transformReadName(source)

  if (transform === null) {
    return null
  }

  const kind = declared.get(transform.name)

  if (kind === undefined || !transformApplies(transform.transform, kind)) {
    return null
  }

  return { state: transform.name, transform: STATE_TRANSFORMS[transform.transform].operation }
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
