import { BaseRuleVisitor } from "./rule-utils.js"
import { ParserRule } from "../types.js"
import { isOutputRender, renderPartialExpression } from "./prism-rule-utils.js"

import { isPrismNodeType, locationFromByteOffset, partialNameForFile, substringFromByteOffset } from "@herb-tools/core"

import type { ERBRenderNode, ParseResult, ParserOptions, PrismNode } from "@herb-tools/core"
import type { BaseAutofixContext, FullRuleConfig, LintContext, LintOffense, Mutable, UnboundLintOffense } from "../types.js"

const QUOTES = ["\"", "'"]

interface PreferQualifiedPartialPathAutofixContext extends BaseAutofixContext {
  node: Mutable<ERBRenderNode>
  literal: string
  replacement: string
}

interface ResolvedPartial {
  qualified: string
  colocated: boolean
}

function directoryOf(file: string): string {
  const index = file.replace(/\\/g, "/").lastIndexOf("/")

  return index === -1 ? "" : file.slice(0, index)
}

function quotedText(source: string, location: PrismNode["location"] | null | undefined): string | null {
  if (!location) return null

  const text = substringFromByteOffset(source, location.startOffset, location.length)

  return QUOTES.includes(text) ? text : null
}

class ActionViewPreferQualifiedPartialPathVisitor extends BaseRuleVisitor<PreferQualifiedPartialPathAutofixContext> {
  visitERBRenderNode(node: ERBRenderNode): void {
    this.checkRender(node)

    this.visitChildNodes(node)
  }

  private checkRender(node: ERBRenderNode): void {
    const call = node.prismNode
    const source = node.source

    if (!call || !source) return
    if (!isOutputRender(node)) return

    const expression = renderPartialExpression(call)

    if (!expression) return
    if (!isPrismNodeType(expression.node, "StringNode")) return

    const name = expression.node.unescaped?.value

    if (!name) return
    if (name.includes("/")) return

    const resolved = this.resolve(name)

    this.addOffense(
      `The partial \`${name}\` is looked up relative to the directory of the template rendering it. Moving this template changes which file that resolves to, and renaming the partial means hunting for callers that never spell its full name. ${this.advice(resolved)}`,
      locationFromByteOffset(source, expression.node.location.startOffset, expression.node.location.length),
      this.autofixContextFor(node, expression.node, source, name, resolved),
    )
  }

  private advice(resolved: ResolvedPartial | null): string {
    if (resolved) {
      return `Write it as \`${resolved.qualified}\` so it resolves to the same file from any template, and a search for \`${resolved.qualified}\` finds every caller.`
    }

    return `Write the full path from the view root so it resolves to the same file from any template, and a search for that path finds every caller.`
  }

  private autofixContextFor(node: ERBRenderNode, string: PrismNode, source: string, name: string, resolved: ResolvedPartial | null): PreferQualifiedPartialPathAutofixContext | undefined {
    if (!resolved?.colocated) return undefined

    const opening = quotedText(source, string.openingLoc)
    const closing = quotedText(source, string.closingLoc)

    if (opening === null || opening !== closing) return undefined

    const content = substringFromByteOffset(source, string.contentLoc.startOffset, string.contentLoc.length)

    if (content !== name) return undefined

    return {
      node: node as Mutable<ERBRenderNode>,
      nodeType: node.end_node ? "AST_ERB_BLOCK_NODE" : "AST_ERB_CONTENT_NODE",
      literal: `${opening}${content}${closing}`,
      replacement: `${opening}${resolved.qualified}${closing}`,
    }
  }

  private resolve(name: string): ResolvedPartial | null {
    const partials = this.context.partials

    if (!partials) return null

    const sourceFile = this.sourceFile
    const declaration = partials.lookup(name, sourceFile)

    if (!declaration) return null

    const qualified = partialNameForFile(declaration.file, partials.viewRoot)

    if (!qualified) return null

    return {
      qualified,
      colocated: sourceFile !== undefined && directoryOf(declaration.file) === directoryOf(sourceFile),
    }
  }
}

export class ActionViewPreferQualifiedPartialPathRule extends ParserRule<PreferQualifiedPartialPathAutofixContext> {
  static ruleName = "actionview-prefer-qualified-partial-path"
  static introducedIn = this.version("unreleased")
  static unsafeAutocorrectable = true
  static autofixRequiresContext = true

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "info",
    }
  }

  get parserOptions(): Partial<ParserOptions> {
    return {
      render_nodes: true,
      prism_nodes: true,
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense<PreferQualifiedPartialPathAutofixContext>[] {
    const visitor = new ActionViewPreferQualifiedPartialPathVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }

  autofix(offense: LintOffense<PreferQualifiedPartialPathAutofixContext>, result: ParseResult): ParseResult | null {
    if (!offense.autofixContext) return null

    const { node, literal, replacement } = offense.autofixContext
    const content = node.content

    if (!content) return null

    const index = content.value.indexOf(literal)

    if (index === -1) return null
    if (content.value.indexOf(literal, index + 1) !== -1) return null

    content.value = content.value.slice(0, index) + replacement + content.value.slice(index + literal.length)

    return result
  }
}
