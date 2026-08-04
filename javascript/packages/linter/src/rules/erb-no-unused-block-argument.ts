import { ParserRule } from "../types.js"
import { BaseRuleVisitor } from "./rule-utils.js"

import { isRubyLiteralNode, isRubyParameterNode, isPrismNodeType, substringFromByteOffset } from "@herb-tools/core"

import type { ERBBlockNode, Node, ParseResult, ParserOptions, PrismNode } from "@herb-tools/core"
import type { FullRuleConfig, LintContext, UnboundLintOffense } from "../types.js"

const IGNORED_PREFIX = "_"
const REPORTED_KINDS = ["positional", "rest"]

const SIMPLE_RECEIVER_TYPES = [
  "ClassVariableReadNode",
  "ConstantPathNode",
  "ConstantReadNode",
  "GlobalVariableReadNode",
  "InstanceVariableReadNode",
  "LocalVariableReadNode",
  "SelfNode",
] as const

class NoUnusedBlockArgumentVisitor extends BaseRuleVisitor {
  visitERBBlockNode(node: ERBBlockNode): void {
    this.checkBlockArguments(node)

    this.visitChildNodes(node)
  }

  private checkBlockArguments(node: ERBBlockNode): void {
    const parameters = node.block_arguments.filter(isRubyParameterNode)
    if (parameters.length === 0) return

    const source = this.rubySourceInBody(node)

    for (const parameter of parameters) {
      const name = parameter.name?.value

      if (!name) continue
      if (name.startsWith(IGNORED_PREFIX)) continue
      if (!REPORTED_KINDS.includes(parameter.kind)) continue
      if (this.referencesName(source, name)) continue

      const suggestion = this.suggestionFor(node, name)

      this.addOffense(
        `Block argument \`${name}\` is never used. ${suggestion}, or prefix it with an underscore as \`_${name}\` to show it is intentionally unused.`,
        parameter.location,
        undefined,
        undefined,
        ["unnecessary"],
      )
    }
  }

  private suggestionFor(node: ERBBlockNode, name: string): string {
    if (name === this.eachWithIndexArgumentName(node)) {
      return `Use \`each\` instead of \`each_with_index\``
    }

    const receiver = this.eachReceiverSource(node, name)

    if (receiver) {
      const opening = node.tag_opening?.value ?? "<%"
      const closing = node.tag_closing?.value ?? "%>"

      return `Remove it and write \`${opening} ${receiver}.each do ${closing}\``
    }

    return `Remove it`
  }

  private eachWithIndexArgumentName(node: ERBBlockNode): string | null {
    const parameters = this.plainBlockParameters(node, "each_with_index")

    if (!parameters) return null
    if (parameters.requireds.length !== 2) return null

    const index = parameters.requireds[1]
    if (!isPrismNodeType(index, "RequiredParameterNode")) return null

    return index.name
  }

  private eachReceiverSource(node: ERBBlockNode, name: string): string | null {
    const call = node.prismNode
    const parameters = this.plainBlockParameters(node, "each")

    if (!parameters) return null
    if (parameters.requireds.length !== 1) return null

    const element = parameters.requireds[0]
    if (!isPrismNodeType(element, "RequiredParameterNode")) return null
    if (element.name !== name) return null
    if (call.isSafeNavigation()) return null

    const receiver = call.receiver
    if (!this.isSimpleReceiver(receiver)) return null

    const source = node.source
    if (!source) return null

    return substringFromByteOffset(source, receiver.location.startOffset, receiver.location.length)
  }

  private plainBlockParameters(node: ERBBlockNode, method: string): PrismNode | null {
    const call = node.prismNode

    if (!isPrismNodeType(call, "CallNode")) return null
    if (call.name !== method) return null
    if (call.arguments_) return null

    const parameters = (call.block as PrismNode)?.parameters?.parameters
    if (!isPrismNodeType(parameters, "ParametersNode")) return null

    if (parameters.optionals.length > 0) return null
    if (parameters.posts.length > 0) return null
    if (parameters.keywords.length > 0) return null
    if (parameters.rest || parameters.keywordRest || parameters.block) return null

    return parameters
  }

  private isSimpleReceiver(node: PrismNode | null | undefined): boolean {
    if (!node) return false
    if (SIMPLE_RECEIVER_TYPES.some(type => isPrismNodeType(node, type))) return true

    if (isPrismNodeType(node, "CallNode")) {
      if (node.arguments_ || node.block) return false
      if (node.isSafeNavigation()) return false
      if (!node.receiver) return true

      return this.isSimpleReceiver(node.receiver)
    }

    return false
  }

  private rubySourceInBody(node: ERBBlockNode): string {
    const sources: string[] = []

    const collect = (current: Node | null | undefined): void => {
      if (!current) return

      if (isRubyLiteralNode(current)) {
        sources.push(current.content)
      } else if (current.type.startsWith("AST_ERB_")) {
        const content = (current as { content?: unknown }).content

        if (content && typeof content === "object" && "value" in content) {
          sources.push(String((content as { value?: unknown }).value ?? ""))
        }
      }

      current.compactChildNodes().forEach(collect)
    }

    node.body.forEach(collect)

    node.rescue_clause && collect(node.rescue_clause)
    node.else_clause && collect(node.else_clause)
    node.ensure_clause && collect(node.ensure_clause)

    return sources.join("\n")
  }

  private referencesName(source: string, name: string): boolean {
    return new RegExp(`(?<![A-Za-z0-9_])${name}(?![A-Za-z0-9_])`).test(source)
  }
}

export class ERBNoUnusedBlockArgumentRule extends ParserRule {
  static ruleName = "erb-no-unused-block-argument"
  static introducedIn = this.version("unreleased")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: {
        cli: "error",
        editor: "info",
      }
    }
  }

  get parserOptions(): Partial<ParserOptions> {
    return {
      prism_nodes: true,
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new NoUnusedBlockArgumentVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
