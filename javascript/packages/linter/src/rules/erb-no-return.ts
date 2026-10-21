import {
  PrismVisitor,
  PrismNodes,
  isPrismNodeType,
  locationFromByteOffset,
} from "@herb-tools/core"
import type { ParseResult, ParserOptions } from "@herb-tools/core"

import { ParserRule } from "../types.js"
import type {
  FullRuleConfig,
  LintContext,
  UnboundLintOffense,
} from "../types.js"

const MESSAGE =
  "Avoid using `return` in ERB templates. Use a conditional or move the logic to a controller or component."

const BLOCK_MESSAGE =
  "Avoid using `return` inside a block or loop in ERB templates because it ends the whole render. Use `next` to skip the rest of the block or `break` to stop iterating."

interface CollectedReturn {
  node: PrismNodes.ReturnNode
  insideBlock: boolean
}

class ReturnCollector extends PrismVisitor {
  readonly returns: CollectedReturn[] = []

  private readonly blockStack: boolean[] = []
  private readonly procBlocks = new Set<PrismNodes.Node>()

  override visitReturnNode(node: PrismNodes.ReturnNode): void {
    this.returns.push({ node, insideBlock: this.blockStack.at(-1) ?? false })
    this.visitChildNodes(node)
  }

  override visitLambdaNode(_node: PrismNodes.LambdaNode): void {}

  override visitDefNode(_node: PrismNodes.DefNode): void {}

  override visitCallNode(node: PrismNodes.CallNode): void {
    const block = node.block

    if (isPrismNodeType(block, "BlockNode")) {
      if (this.isReturnScope(node)) {
        node.receiver?.accept(this)
        node.arguments_?.accept(this)

        return
      }

      if (this.isProc(node)) {
        this.procBlocks.add(block)
      }
    }

    this.visitChildNodes(node)
  }

  override visitBlockNode(node: PrismNodes.BlockNode): void {
    this.withinBlock(!this.procBlocks.has(node), () => this.visitChildNodes(node))
  }

  override visitWhileNode(node: PrismNodes.WhileNode): void {
    this.withinBlock(true, () => this.visitChildNodes(node))
  }

  override visitUntilNode(node: PrismNodes.UntilNode): void {
    this.withinBlock(true, () => this.visitChildNodes(node))
  }

  override visitForNode(node: PrismNodes.ForNode): void {
    this.withinBlock(true, () => this.visitChildNodes(node))
  }

  private withinBlock(suggestNext: boolean, visit: () => void): void {
    this.blockStack.push(suggestNext)
    visit()
    this.blockStack.pop()
  }

  private isReturnScope(node: PrismNodes.CallNode): boolean {
    if (node.name === "define_method") return true

    return node.receiver === null && node.name === "lambda"
  }

  private isProc(node: PrismNodes.CallNode): boolean {
    if (node.receiver === null) return node.name === "proc"

    return (
      node.name === "new" &&
      isPrismNodeType(node.receiver, "ConstantReadNode") &&
      node.receiver.name === "Proc"
    )
  }
}

export class ERBNoReturnRule extends ParserRule {
  static ruleName = "erb-no-return"
  static introducedIn = this.version("0.11.0")
  static defaultEnabledIn = this.version("0.11.0")

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

  check(
    result: ParseResult,
    _context?: Partial<LintContext>,
  ): UnboundLintOffense[] {
    const source = result.value.source
    if (!source) return []

    const program = result.value.prismNode
    if (!program) return []

    const collector = new ReturnCollector()
    collector.visit(program)

    return collector.returns.map(({ node, insideBlock }) => {
      const { startOffset, length } = node.keywordLoc

      return this.createOffense(
        insideBlock ? BLOCK_MESSAGE : MESSAGE,
        locationFromByteOffset(source, startOffset, length),
      )
    })
  }
}
