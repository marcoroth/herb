import postcss from "postcss"

import { getTagLocalName, getStaticBodyText, isLiteralNode, isHTMLTextNode } from "@herb-tools/core"

import { Location } from "@herb-tools/core"
import { BaseRuleVisitor } from "../utils/rule-utils.js"
import { ParserRule } from "../types.js"

import type { ParseResult, HTMLElementNode, Position } from "@herb-tools/core"
import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"

class NoEmptyCSSRuleVisitor extends BaseRuleVisitor {
  visitHTMLElementNode(node: HTMLElementNode): void {
    if (getTagLocalName(node) === "style") {
      const css = this.staticCSS(node)

      if (css !== null) {
        this.check(node, css)
      }
    }

    super.visitHTMLElementNode(node)
  }

  private check(node: HTMLElementNode, css: string): void {
    let root: postcss.Root

    try {
      root = postcss.parse(css)
    } catch {
      return
    }

    const base = node.open_tag?.location?.end ?? null

    root.walkRules((rule) => {
      if (rule.nodes.length > 0) return

      const selector = rule.selector.trim()
      const start = rule.source?.start?.offset ?? null
      const end = rule.source?.end?.offset ?? null
      const length = start !== null && end !== null ? end - start : selector.length

      this.addOffense(
        `The \`${selector}\` rule in this \`<style>\` block has no declarations, so it does nothing. Give it the styles it should apply, or remove it.`,
        this.locate(node, base, css, start, length),
        undefined,
        undefined,
        ["unnecessary"],
      )
    })
  }

  private locate(node: HTMLElementNode, base: Position | null, css: string, offset: number | null, length: number): Location {
    if (base === null || offset === null) return node.open_tag!.location

    const start = this.position(base, css, offset)
    const end = this.position(base, css, offset + length)

    return Location.from(start.line, start.column, end.line, end.column)
  }

  private position(base: Position, css: string, offset: number): { line: number, column: number } {
    const before = css.slice(0, offset)
    const newlines = (before.match(/\n/g) || []).length

    if (newlines === 0) {
      return { line: base.line, column: base.column + offset }
    }

    return { line: base.line + newlines, column: offset - before.lastIndexOf("\n") - 1 }
  }

  private staticCSS(node: HTMLElementNode): string | null {
    const body = node.body ?? []
    const only = body[0]

    if (body.length !== 1 || !only || (!isLiteralNode(only) && !isHTMLTextNode(only))) {
      return null
    }

    return getStaticBodyText(body)
  }
}

export class HTMLNoEmptyCSSRuleRule extends ParserRule {
  static ruleName = "html-no-empty-css-rule"
  static introducedIn = this.version("unreleased")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: {
        cli: "error",
        editor: "info",
      },
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new NoEmptyCSSRuleVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
