import { HERB_ATTRIBUTES } from "@herb-tools/client/directives"

import { BrowserRule } from "../rule.js"

import type { DOMNodeLike, DOMElementLike } from "../dom-to-ast.js"
import type { UnboundLintOffense, LintContext } from "../../types.js"
import type { FullRuleConfig } from "../../types.js"

interface CSSRuleLike {
  selectorText?: string
  cssRules?: ArrayLike<CSSRuleLike>
}

interface StyleSheetLike {
  cssRules: ArrayLike<CSSRuleLike>
}

interface StyleElementLike extends DOMElementLike {
  sheet?: StyleSheetLike | null
}

interface ScopedStyleElement extends StyleElementLike {
  tagName: "style"
  localName: "style"
}

interface QueryableLike extends DOMNodeLike {
  querySelectorAll(selectors: string): ArrayLike<unknown>
  matches?(selectors: string): boolean
}

const ELEMENT_NODE = 1

function isElement(node: DOMNodeLike): node is DOMElementLike {
  return node.nodeType === ELEMENT_NODE
}

function isStyleElement(node: DOMElementLike): node is StyleElementLike {
  return node.localName == "style"
}

function attributeValue(element: DOMElementLike, name: string): string | null {
  for (const attribute of Array.from(element.attributes)) {
    if (attribute.name === name) {
      return attribute.value
    }
  }

  return null
}

function hasAttribute(element: DOMElementLike, name: string): boolean {
  return Array.from(element.attributes).some((attribute) => attribute.name === name)
}

function elements(root: DOMNodeLike): DOMElementLike[] {
  if (!isElement(root) && !("childNodes" in root)) return []

  const found: DOMElementLike[] = []
  const queue: DOMNodeLike[] = [root]

  while (queue.length > 0) {
    const node = queue.shift()!

    if (isElement(node)) {
      found.push(node)
    }

    const children = (node as { childNodes?: ArrayLike<DOMNodeLike> }).childNodes

    if (children) {
      queue.push(...Array.from(children))
    }
  }

  return found
}

function selectors(rules: ArrayLike<CSSRuleLike>): string[] {
  return Array.from(rules).flatMap((rule) => {
    if (rule.selectorText) {
      return [rule.selectorText]
    }

    if (rule.cssRules) {
      return selectors(rule.cssRules)
    }

    return []
  })
}

// A selector gated on interaction state, like `.card:hover img`, matches
// nothing while nobody interacts, so the transient pseudo-classes drop out
// and the check asks whether the markup they were written for exists.
const TRANSIENT_PSEUDO = /:(?:hover|focus-within|focus-visible|focus|active|visited|target)\b/g

// A pseudo-element never matches in the query APIs, so `.card::before` is
// checked on its originating element instead.
const PSEUDO_ELEMENT = /::[a-z-]+(?:\([^)]*\))?|:(?:before|after|first-line|first-letter)\b/g

function matches(scope: QueryableLike, selector: string): boolean {
  const resting = selector.replace(TRANSIENT_PSEUDO, "").replace(PSEUDO_ELEMENT, "")

  if (resting.trim().length === 0) {
    return true
  }

  try {
    if (scope.matches?.(resting)) {
      return true
    }

    return scope.querySelectorAll(resting).length > 0
  } catch {
    return true
  }
}

function isScoped(element: DOMElementLike): element is ScopedStyleElement {
  return isStyleElement(element) && hasAttribute(element, "scoped") || attributeValue(element, HERB_ATTRIBUTES.styleScoped) !== null
}

function splitOutsideBrackets(selector: string, separators: string): string[] {
  const parts: string[] = []

  let depth = 0
  let quote: string | null = null
  let current = ""

  for (const character of selector) {
    if (quote) {
      if (character === quote) {
        quote = null
      }

      current += character

      continue
    }

    if (character === '"' || character === "'") {
      quote = character
      current += character

      continue
    }

    if (character === "(" || character === "[") {
      depth += 1
    } else if (character === ")" || character === "]") {
      depth -= 1
    }

    if (depth === 0 && separators.includes(character)) {
      parts.push(current)
      current = ""

      continue
    }

    current += character
  }

  parts.push(current)

  return parts
}

function lastCompound(selector: string): string | null {
  const groups = splitOutsideBrackets(selector, ",")
    .map((group) => {
      const compounds = splitOutsideBrackets(group.trim(), " >+~")
        .map((compound) => compound.trim())
        .filter((compound) => compound.length > 0)

      return compounds[compounds.length - 1] ?? ""
    })
    .filter((group) => group.length > 0)

  if (groups.length === 0) {
    return null
  }

  return groups.join(", ")
}

interface CompoundParts {
  core: string
  classes: string[]
  valued: Array<{ name: string, test: string }>
}

interface DynamicElementLike {
  getAttribute?(name: string): string | null
  matches?(selectors: string): boolean
}

function simpleSelectors(compound: string): string[] {
  const parts: string[] = []

  let depth = 0
  let quote: string | null = null
  let current = ""

  for (const character of compound) {
    if (quote) {
      if (character === quote) {
        quote = null
      }

      current += character

      continue
    }

    if (character === '"' || character === "'") {
      quote = character
      current += character

      continue
    }

    if (character === "(" || character === "[") {
      depth += 1
    } else if (character === ")" || character === "]") {
      depth -= 1
    }

    const opensBracket = character === "[" && depth === 1
    const startsSimple = (character === "." || character === "#" || character === ":") && depth === 0 && !current.endsWith(":")

    if ((opensBracket || startsSimple) && current.length > 0) {
      parts.push(current)
      current = ""
    }

    current += character
  }

  if (current.length > 0) {
    parts.push(current)
  }

  return parts
}

const VALUED_ATTRIBUTE = /^\[([^\]~^$*|=]+)[~^$*|]?=/

function compoundParts(compound: string): CompoundParts {
  const kept: string[] = []
  const classes: string[] = []
  const valued: Array<{ name: string, test: string }> = []

  for (const part of simpleSelectors(compound)) {
    if (part.startsWith(".")) {
      classes.push(part)

      continue
    }

    const attribute = part.match(VALUED_ATTRIBUTE)

    if (attribute) {
      valued.push({ name: attribute[1].trim(), test: part })

      continue
    }

    kept.push(part)
  }

  return { core: kept.join("") || "*", classes, valued }
}

function dynamicAttributeNames(element: DynamicElementLike): Set<string> {
  const raw = element.getAttribute?.(HERB_ATTRIBUTES.slot) ?? ""
  const names = new Set<string>()

  for (const entry of raw.split(/\s+/).filter(Boolean)) {
    const [, , ...name] = entry.split(":")

    if (name.length > 0) {
      names.add(name.join(":"))
    }
  }

  return names
}

// A parked element whose attribute is a blanked slot, like the class part a
// state writes at runtime, can satisfy the requirements on that attribute
// even though the parked markup does not show them.
function satisfiedWithDynamics(root: QueryableLike, compound: string): boolean {
  const { core, classes, valued } = compoundParts(compound)

  if (classes.length === 0 && valued.length === 0) {
    return false
  }

  let candidates: ArrayLike<unknown>

  try {
    candidates = root.querySelectorAll(core)
  } catch {
    return true
  }

  return Array.from(candidates).some((candidate) => {
    const element = candidate as DynamicElementLike

    if (typeof element.matches !== "function") {
      return false
    }

    const dynamic = dynamicAttributeNames(element)

    for (const test of classes) {
      if (!element.matches(test) && !dynamic.has("class")) {
        return false
      }
    }

    for (const { name, test } of valued) {
      if (!element.matches(test) && !dynamic.has(name)) {
        return false
      }
    }

    return true
  })
}

// Parked markup holds no ancestors outside its own fragment, and its blanked
// slots drop value-dependent attributes and classes, so a selector that fails
// as a whole still counts when its innermost compound finds the markup it was
// written for.
function matchesParked(root: QueryableLike, selector: string): boolean {
  if (matches(root, selector)) {
    return true
  }

  const compound = lastCompound(selector)

  if (compound === null) {
    return false
  }

  if (compound !== selector && matches(root, compound)) {
    return true
  }

  return satisfiedWithDynamics(root, compound.replace(TRANSIENT_PSEUDO, ""))
}

export class BrowserScopedStyleNoUnusedSelectorRule extends BrowserRule {
  static ruleName = "browser-scoped-style-no-unused-selector"

  get defaultConfig(): FullRuleConfig {
    return {
      ...super.defaultConfig,
      severity: "info"
    }
  }

  check(root: DOMNodeLike, context?: Partial<LintContext>): UnboundLintOffense[] {
    const scope = root as QueryableLike

    if (typeof scope.querySelectorAll !== "function") {
      return []
    }

    const parked = Array.from(context?.parkedRoots?.() ?? []).filter(
      (candidate): candidate is QueryableLike => typeof (candidate as QueryableLike).querySelectorAll === "function"
    )

    const offenses: UnboundLintOffense[] = []

    for (const element of elements(root)) {
      if (!isScoped(element)) continue
      if (!element.sheet) continue

      for (const selector of selectors(element.sheet.cssRules)) {
        if (matches(scope, selector)) {
          continue
        }

        if (parked.some((candidate) => matchesParked(candidate, selector))) {
          continue
        }

        offenses.push(
          this.createOffense(
            `Selector \`${selector}\` matches nothing on the rendered page. Remove it, or check whether the markup it was written for still exists.`,
            element
          )
        )
      }
    }

    return offenses
  }
}
