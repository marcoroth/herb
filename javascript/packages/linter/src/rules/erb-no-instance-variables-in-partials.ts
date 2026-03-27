import { PrismVisitor, PrismNodes } from "@herb-tools/core"
import { ParserRule } from "../types.js"

import { isPartialFile } from "./file-utils.js"
import { locationFromOffset } from "./rule-utils.js"

import type { ParseResult, ParserOptions, PrismLocation } from "@herb-tools/core"
import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"

interface InstanceVariableNode {
  name: string
  location: PrismLocation
}

type InstanceVariableUsage = "read" | "write"

interface InstanceVariableReference {
  name: string
  usage: InstanceVariableUsage
  startOffset: number
  length: number
}

class InstanceVariableCollector extends PrismVisitor {
  public readonly instanceVariables: InstanceVariableReference[] = []

  visitInstanceVariableReadNode(node: PrismNodes.InstanceVariableReadNode): void {
    this.collect(node, "read")
  }

  visitInstanceVariableWriteNode(node: PrismNodes.InstanceVariableWriteNode): void {
    this.collect(node, "write")
  }

  visitInstanceVariableAndWriteNode(node: PrismNodes.InstanceVariableAndWriteNode): void {
    this.collect(node, "write")
  }

  visitInstanceVariableOrWriteNode(node: PrismNodes.InstanceVariableOrWriteNode): void {
    this.collect(node, "write")
  }

  visitInstanceVariableOperatorWriteNode(node: PrismNodes.InstanceVariableOperatorWriteNode): void {
    this.collect(node, "write")
  }

  visitInstanceVariableTargetNode(node: PrismNodes.InstanceVariableTargetNode): void {
    this.collect(node, "write")
  }

  private collect(node: InstanceVariableNode, usage: InstanceVariableUsage): void {
    this.instanceVariables.push({
      name: node.name,
      usage,
      startOffset: node.location.startOffset,
      length: node.location.length
    })
  }
}

export class ERBNoInstanceVariablesInPartialsRule extends ParserRule {
  static ruleName = "erb-no-instance-variables-in-partials"
  static introducedIn = this.version("0.9.0")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error",
    }
  }

  get parserOptions(): Partial<ParserOptions> {
    return {
      track_whitespace: true,
      prism_program: true,
    }
  }

  isEnabled(_result: ParseResult, context?: Partial<LintContext>): boolean {
    return isPartialFile(context?.fileName) === true
  }

  check(result: ParseResult, _context?: Partial<LintContext>): UnboundLintOffense[] {
    const source = result.value.source
    const prismNode = result.value.prismNode

    if (!prismNode || !source) return []

    const collector = new InstanceVariableCollector()

    collector.visit(prismNode)

    return collector.instanceVariables.map(ivar => {
      const location = locationFromOffset(source, ivar.startOffset, ivar.length)
      const message = ivar.usage === "read"
        ? `Avoid using instance variables in partials. Pass \`${ivar.name}\` as a local variable instead.`
        : `Avoid setting instance variables in partials. Use a local variable instead of \`${ivar.name}\`.`

      return this.createOffense(message, location)
    })
  }
}
