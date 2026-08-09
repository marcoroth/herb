import { ParserRule } from "../types.js"
import { PrismVisitor, isPrismNodeType, locationFromByteOffset } from "@herb-tools/core"

import type { ParseResult, ParserOptions, PrismNodes } from "@herb-tools/core"
import type { FullRuleConfig, LintContext, UnboundLintOffense } from "../types.js"

const IGNORED_PREFIX = "_"

class LocalVariableCollector extends PrismVisitor {
  readonly writes: PrismNodes.LocalVariableWriteNode[] = []
  readonly referenced = new Set<string>()
  readonly argumentWrites = new Set<PrismNodes.LocalVariableWriteNode>()

  override visitCallNode(node: PrismNodes.CallNode): void {
    for (const argument of node.arguments_?.arguments_ ?? []) {
      if (isPrismNodeType(argument, "LocalVariableWriteNode")) this.argumentWrites.add(argument)
    }

    this.visitChildNodes(node)
  }

  override visitLocalVariableWriteNode(node: PrismNodes.LocalVariableWriteNode): void {
    this.writes.push(node)

    this.visitChildNodes(node)
  }

  override visitLocalVariableReadNode(node: PrismNodes.LocalVariableReadNode): void {
    this.referenced.add(node.name)

    this.visitChildNodes(node)
  }

  override visitLocalVariableOperatorWriteNode(node: PrismNodes.LocalVariableOperatorWriteNode): void {
    this.referenced.add(node.name)

    this.visitChildNodes(node)
  }

  override visitLocalVariableAndWriteNode(node: PrismNodes.LocalVariableAndWriteNode): void {
    this.referenced.add(node.name)

    this.visitChildNodes(node)
  }

  override visitLocalVariableOrWriteNode(node: PrismNodes.LocalVariableOrWriteNode): void {
    this.referenced.add(node.name)

    this.visitChildNodes(node)
  }
}

export class ERBNoUnusedLocalVariableRule extends ParserRule {
  static ruleName = "erb-no-unused-local-variable"
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

  get parserOptions(): Partial<ParserOptions> {
    return {
      prism_program: true,
    }
  }

  check(result: ParseResult, _context?: Partial<LintContext>): UnboundLintOffense[] {
    const program = result.value.prismNode
    const source = result.value.source

    if (!program) return []
    if (!source) return []

    const collector = new LocalVariableCollector()

    collector.visit(program)

    const unused = collector.writes.filter(write => !write.name.startsWith(IGNORED_PREFIX) && !collector.referenced.has(write.name))

    return unused.map(write => {
      const { startOffset, length } = write.nameLoc

      return this.createOffense(
        `Local variable \`${write.name}\` is assigned but never used. ${this.adviceFor(collector, write, write.name)}`,
        locationFromByteOffset(source, startOffset, length),
        undefined,
        undefined,
        ["unnecessary"],
      )
    })
  }

  private adviceFor(collector: LocalVariableCollector, write: PrismNodes.LocalVariableWriteNode, name: string): string {
    if (collector.argumentWrites.has(write)) {
      return `This assignment sits in an argument list, where it still passes the value positionally. Write \`${name}:\` if you meant a keyword argument, or drop the \`${name} =\`.`
    }

    return `Remove the assignment, or prefix it with an underscore as \`_${name}\` to show it is intentionally unused.`
  }
}
