import { ParserRule } from "../types.js"
import { BaseRuleVisitor } from "./rule-utils.js"

import { isRubyLiteralNode, isRubyParameterNode } from "@herb-tools/core"

import type { ERBIterationBlockNode, Node, ParseResult, ParserOptions } from "@herb-tools/core"
import type { FullRuleConfig, LintContext, UnboundLintOffense } from "../types.js"

const IGNORED_PREFIX = "_"
const REPORTED_KINDS = ["positional", "rest"]

class NoUnusedBlockArgumentVisitor extends BaseRuleVisitor {
  visitERBIterationBlockNode(node: ERBIterationBlockNode): void {
    this.checkBlockArguments(node)

    this.visitChildNodes(node)
  }

  private checkBlockArguments(node: ERBIterationBlockNode): void {
    const parameters = node.block_arguments.filter(isRubyParameterNode)
    if (parameters.length === 0) return

    const source = this.rubySourceInBody(node)

    for (const parameter of parameters) {
      const name = parameter.name?.value

      if (!name) continue
      if (name.startsWith(IGNORED_PREFIX)) continue
      if (!REPORTED_KINDS.includes(parameter.kind)) continue
      if (this.referencesName(source, name)) continue

      this.addOffense(
        `Block argument \`${name}\` is never used. Remove it, or prefix it with an underscore as \`_${name}\` to show it is intentionally unused.`,
        parameter.location,
      )
    }
  }

  private rubySourceInBody(node: ERBIterationBlockNode): string {
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
      severity: "error"
    }
  }

  get parserOptions(): Partial<ParserOptions> {
    return {
      iteration_nodes: true,
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new NoUnusedBlockArgumentVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
