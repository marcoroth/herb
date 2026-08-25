import { ParserRule } from "../types.js"
import { StateScopeMap } from "../utils/state-directives-utils.js"
import { PrismVisitor, isPrismNodeType, locationFromByteOffset } from "@herb-tools/core"

import type { ParseResult, ParserOptions, PrismNodes } from "@herb-tools/core"
import type { FullRuleConfig, LintContext, UnboundLintOffense } from "../types.js"

const IGNORED_PREFIX = "_"

interface Scope {
  readonly writes: PrismNodes.LocalVariableWriteNode[]
  readonly referenced: Set<string>
}

class LocalVariableCollector extends PrismVisitor {
  readonly argumentWrites = new Set<PrismNodes.LocalVariableWriteNode>()

  private readonly scopes: Scope[] = []
  private readonly stack: Scope[] = []

  get unusedWrites(): PrismNodes.LocalVariableWriteNode[] {
    const unused = this.scopes.flatMap(scope => scope.writes.filter(write => !scope.referenced.has(write.name)))

    return unused.sort((first, second) => first.nameLoc.startOffset - second.nameLoc.startOffset)
  }

  override visitProgramNode(node: PrismNodes.ProgramNode): void {
    this.withScope(() => this.visitChildNodes(node))
  }

  override visitBlockNode(node: PrismNodes.BlockNode): void {
    this.withScope(() => this.visitChildNodes(node))
  }

  override visitLambdaNode(node: PrismNodes.LambdaNode): void {
    this.withScope(() => this.visitChildNodes(node))
  }

  override visitDefNode(node: PrismNodes.DefNode): void {
    this.withScope(() => this.visitChildNodes(node))
  }

  override visitClassNode(node: PrismNodes.ClassNode): void {
    this.withScope(() => this.visitChildNodes(node))
  }

  override visitModuleNode(node: PrismNodes.ModuleNode): void {
    this.withScope(() => this.visitChildNodes(node))
  }

  override visitSingletonClassNode(node: PrismNodes.SingletonClassNode): void {
    this.withScope(() => this.visitChildNodes(node))
  }

  override visitCallNode(node: PrismNodes.CallNode): void {
    for (const argument of node.arguments_?.arguments_ ?? []) {
      if (isPrismNodeType(argument, "LocalVariableWriteNode")) this.argumentWrites.add(argument)
    }

    this.visitChildNodes(node)
  }

  override visitLocalVariableWriteNode(node: PrismNodes.LocalVariableWriteNode): void {
    if (!node.name.startsWith(IGNORED_PREFIX)) this.scopeAt(node.depth)?.writes.push(node)

    this.visitChildNodes(node)
  }

  override visitLocalVariableReadNode(node: PrismNodes.LocalVariableReadNode): void {
    this.reference(node.name, node.depth)

    this.visitChildNodes(node)
  }

  override visitLocalVariableOperatorWriteNode(node: PrismNodes.LocalVariableOperatorWriteNode): void {
    this.reference(node.name, node.depth)

    this.visitChildNodes(node)
  }

  override visitLocalVariableAndWriteNode(node: PrismNodes.LocalVariableAndWriteNode): void {
    this.reference(node.name, node.depth)

    this.visitChildNodes(node)
  }

  override visitLocalVariableOrWriteNode(node: PrismNodes.LocalVariableOrWriteNode): void {
    this.reference(node.name, node.depth)

    this.visitChildNodes(node)
  }

  private withScope(visitChildren: () => void): void {
    const scope: Scope = { writes: [], referenced: new Set<string>() }

    this.scopes.push(scope)
    this.stack.push(scope)

    visitChildren()

    this.stack.pop()
  }

  private reference(name: string, depth: number): void {
    this.scopeAt(depth)?.referenced.add(name)
  }

  private scopeAt(depth: number): Scope | null {
    return this.stack[this.stack.length - 1 - depth] ?? null
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

    const stateNames = new Set(StateScopeMap.collect(result.value).allNames())

    return collector.unusedWrites.filter(write => !stateNames.has(String(write.name))).map(write => {
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
