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

function matches(scope: QueryableLike, selector: string): boolean {
  const resting = selector.replace(TRANSIENT_PSEUDO, "")

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

export class BrowserScopedStyleNoUnusedSelectorRule extends BrowserRule {
  static ruleName = "browser-scoped-style-no-unused-selector"

  get defaultConfig(): FullRuleConfig {
    return {
      ...super.defaultConfig,
      severity: "info"
    }
  }

  check(root: DOMNodeLike, _context?: Partial<LintContext>): UnboundLintOffense[] {
    const scope = root as QueryableLike

    if (typeof scope.querySelectorAll !== "function") {
      return []
    }

    const offenses: UnboundLintOffense[] = []

    for (const element of elements(root)) {
      if (!isScoped(element)) continue
      if (!element.sheet) continue

      for (const selector of selectors(element.sheet.cssRules)) {
        if (matches(scope, selector)) {
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
