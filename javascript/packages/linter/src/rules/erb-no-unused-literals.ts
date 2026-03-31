import { ParserRule } from "../types.js"
import { BaseRuleVisitor } from "./rule-utils.js"
import { PrismVisitor, PrismNodes } from "@herb-tools/core"

import { isERBOutputNode } from "@herb-tools/core"
import { locationFromOffset } from "./rule-utils.js"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { ParseResult, ERBContentNode, ParserOptions, PrismNode } from "@herb-tools/core"

class LiteralCollector extends PrismVisitor {
  public readonly literals: PrismNode[] = []

  override visit(node: PrismNode): void {
    if (!node) return

    super.visit(node)
  }

  visitCallNode(node: PrismNode): void {
    this.visit(node.receiver) // Only visit the receiver of a call, not its arguments.
  }

  // Stop traversal into all assignment node types.
  visitLocalVariableWriteNode(): void {}
  visitLocalVariableAndWriteNode(): void {}
  visitLocalVariableOperatorWriteNode(): void {}
  visitLocalVariableOrWriteNode(): void {}
  visitInstanceVariableWriteNode(): void {}
  visitInstanceVariableAndWriteNode(): void {}
  visitInstanceVariableOperatorWriteNode(): void {}
  visitInstanceVariableOrWriteNode(): void {}
  visitClassVariableWriteNode(): void {}
  visitClassVariableAndWriteNode(): void {}
  visitClassVariableOperatorWriteNode(): void {}
  visitClassVariableOrWriteNode(): void {}
  visitGlobalVariableWriteNode(): void {}
  visitGlobalVariableAndWriteNode(): void {}
  visitGlobalVariableOperatorWriteNode(): void {}
  visitGlobalVariableOrWriteNode(): void {}
  visitConstantWriteNode(): void {}
  visitConstantAndWriteNode(): void {}
  visitConstantOperatorWriteNode(): void {}
  visitConstantOrWriteNode(): void {}
  visitConstantPathWriteNode(): void {}
  visitConstantPathAndWriteNode(): void {}
  visitConstantPathOperatorWriteNode(): void {}
  visitConstantPathOrWriteNode(): void {}
  visitIndexAndWriteNode(): void {}
  visitIndexOperatorWriteNode(): void {}
  visitIndexOrWriteNode(): void {}
  visitCallAndWriteNode(): void {}
  visitCallOperatorWriteNode(): void {}
  visitCallOrWriteNode(): void {}
  visitMultiWriteNode(): void {}
  visitMatchWriteNode(): void {}

  visitArrayNode(node: PrismNodes.ArrayNode): void {
    this.literals.push(node)
  }

  visitFalseNode(node: PrismNodes.FalseNode): void {
    this.literals.push(node)
  }

  visitFloatNode(node: PrismNodes.FloatNode): void {
    this.literals.push(node)
  }

  visitHashNode(node: PrismNodes.HashNode): void {
    this.literals.push(node)
  }

  visitImaginaryNode(node: PrismNodes.ImaginaryNode): void {
    this.literals.push(node)
  }

  visitIntegerNode(node: PrismNodes.IntegerNode): void {
    this.literals.push(node)
  }

  visitNilNode(node: PrismNodes.NilNode): void {
    this.literals.push(node)
  }

  visitRangeNode(node: PrismNodes.RangeNode): void {
    this.literals.push(node)
  }

  visitRationalNode(node: PrismNodes.RationalNode): void {
    this.literals.push(node)
  }

  visitRegularExpressionNode(node: PrismNodes.RegularExpressionNode): void {
    this.literals.push(node)
  }

  visitStringNode(node: PrismNodes.StringNode): void {
    this.literals.push(node)
  }

  visitInterpolatedStringNode(node: PrismNodes.InterpolatedStringNode): void {
    this.literals.push(node)
  }

  visitSymbolNode(node: PrismNodes.SymbolNode): void {
    this.literals.push(node)
  }

  visitTrueNode(node: PrismNodes.TrueNode): void {
    this.literals.push(node)
  }
}

class ERBNoUnusedLiteralsVisitor extends BaseRuleVisitor {
  visitERBContentNode(node: ERBContentNode): void {
    if (isERBOutputNode(node)) return

    const prismNode = node.prismNode
    if (!prismNode) return

    const source = node.source
    if (!source) return

    const collector = new LiteralCollector()
    collector.visit(prismNode)

    for (const literal of collector.literals) {
      const { startOffset, length } = literal.location
      const literalSource = source.substring(startOffset, startOffset + length)
      const location = locationFromOffset(source, startOffset, length)

      this.addOffense(
        `Avoid using silent ERB tags for literals. \`${literalSource}\` is evaluated but never used or output.`,
        location,
        undefined,
        undefined,
        ["unnecessary"],
      )
    }
  }
}

export class ERBNoUnusedLiteralsRule extends ParserRule {
  static ruleName = "erb-no-unused-literals"
  static introducedIn = this.version("0.9.3")

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
    const visitor = new ERBNoUnusedLiteralsVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
