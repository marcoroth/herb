import { BrowserRule } from "../rule.js"

import type { DOMNodeLike, DOMElementLike } from "../dom-to-ast.js"
import type { UnboundLintOffense, LintContext } from "../../types.js"

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

interface QueryableLike extends DOMNodeLike {
  querySelectorAll(selectors: string): ArrayLike<unknown>
  matches?(selectors: string): boolean
}

const ELEMENT_NODE = 1
export const ANCHOR_ATTRIBUTE = "data-herb-style-scoped"

function isElement(node: DOMNodeLike): node is DOMElementLike {
  return node.nodeType === ELEMENT_NODE
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

function matches(scope: QueryableLike, selector: string): boolean {
  try {
    if (scope.matches?.(selector)) {
      return true
    }

    return scope.querySelectorAll(selector).length > 0
  } catch {
    return true
  }
}

function isScoped(element: DOMElementLike): boolean {
  return hasAttribute(element, "scoped") || attributeValue(element, ANCHOR_ATTRIBUTE) !== null
}

export class BrowserScopedStyleNoUnusedSelectorRule extends BrowserRule {
  static ruleName = "browser-scoped-style-no-unused-selector"

  check(root: DOMNodeLike, _context?: Partial<LintContext>): UnboundLintOffense[] {
    const scope = root as QueryableLike

    if (typeof scope.querySelectorAll !== "function") return []

    const offenses: UnboundLintOffense[] = []

    for (const element of elements(root)) {
      if (element.tagName.toLowerCase() !== "style") continue
      if (!isScoped(element)) continue

      const sheet = (element as StyleElementLike).sheet
      if (!sheet) continue

      for (const selector of selectors(sheet.cssRules)) {
        if (matches(scope, selector)) continue

        offenses.push(
          this.createOffense(
            `Selector \`${selector}\` matches nothing on the rendered page. Remove it, or check whether the markup it was written for still exists.`
          )
        )
      }
    }

    return offenses
  }
}
