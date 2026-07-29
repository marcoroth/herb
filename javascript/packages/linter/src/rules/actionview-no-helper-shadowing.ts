import { ParserRule } from "../types.js"
import { BaseRuleVisitor } from "./rule-utils.js"

import { getHelperEntries, isRubyParameterNode, isPrismNodeType, PrismVisitor, locationFromByteOffset } from "@herb-tools/core"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type {
  ParseResult,
  ParserOptions,
  ERBBlockNode,
  ERBRenderNode,
  ERBStrictLocalsNode,
  ERBContentNode,
  ERBForNode,
  Node,
  PrismNode,
} from "@herb-tools/core"

const SHADOWABLE_HELPER_NAMES = new Set(
  getHelperEntries()
    .filter(helper => helper.supported)
    .flatMap(helper => [helper.name, ...helper.aliases])
)

interface LocalBinding {
  name: string
  startOffset: number
  length: number
}

const LOCAL_BINDING_PRISM_TYPES = [
  "LocalVariableWriteNode",
  "LocalVariableAndWriteNode",
  "LocalVariableOrWriteNode",
  "LocalVariableOperatorWriteNode",
  "LocalVariableTargetNode",
] as const

class LocalBindingCollector extends PrismVisitor {
  public readonly bindings: LocalBinding[] = []

  override visit(node: PrismNode): void {
    if (!node) return

    if (LOCAL_BINDING_PRISM_TYPES.some(type => isPrismNodeType(node, type))) {
      const location = node.nameLoc ?? node.location

      if (typeof node.name === "string" && location) {
        this.bindings.push({ name: node.name, startOffset: location.startOffset, length: location.length })
      }
    }

    for (const child of node.childNodes?.() ?? []) {
      if (child) this.visit(child)
    }
  }
}

function shadowingMessage(name: string): string {
  return `Local variable \`${name}\` shadows the Action View \`${name}\` helper. Rename it to avoid confusion (for example \`${name}_item\`).`
}

class NoHelperShadowingVisitor extends BaseRuleVisitor {
  visitERBBlockNode(node: ERBBlockNode): void {
    this.checkParameters(node.block_arguments)
    this.visitChildNodes(node)
  }

  visitERBRenderNode(node: ERBRenderNode): void {
    this.checkParameters(node.block_arguments)
    this.visitChildNodes(node)
  }

  visitERBStrictLocalsNode(node: ERBStrictLocalsNode): void {
    this.checkParameters(node.locals)
    this.visitChildNodes(node)
  }

  visitERBContentNode(node: ERBContentNode): void {
    this.checkLocalBindings(node)
    this.visitChildNodes(node)
  }

  visitERBForNode(node: ERBForNode): void {
    this.checkForLoopTargets(node)
    this.visitChildNodes(node)
  }

  private checkParameters(parameters: Node[] | null | undefined): void {
    if (!parameters) return

    for (const parameter of parameters) {
      if (!isRubyParameterNode(parameter)) continue

      const name = parameter.name?.value

      if (!name || !SHADOWABLE_HELPER_NAMES.has(name)) continue

      this.addOffense(shadowingMessage(name), parameter.name!.location)
    }
  }

  private checkLocalBindings(node: ERBContentNode): void {
    const prismNode = node.prismNode
    const source = node.source

    if (!prismNode || !source) return

    const collector = new LocalBindingCollector()
    collector.visit(prismNode)

    for (const binding of collector.bindings) {
      if (!SHADOWABLE_HELPER_NAMES.has(binding.name)) continue

      this.addOffense(
        shadowingMessage(binding.name),
        locationFromByteOffset(source, binding.startOffset, binding.length),
      )
    }
  }

  private checkForLoopTargets(node: ERBForNode): void {
    const content = node.content
    if (!content) return

    const match = content.value.match(/\bfor\b([\s\S]+?)\bin\b/)
    if (!match) return

    for (const rawTarget of match[1].split(",")) {
      const name = rawTarget.trim().replace(/^\*/, "")

      if (!/^[A-Za-z_]\w*$/.test(name) || !SHADOWABLE_HELPER_NAMES.has(name)) continue

      this.addOffense(shadowingMessage(name), content.location)
    }
  }
}

export class ActionViewNoHelperShadowingRule extends ParserRule {
  static ruleName = "actionview-no-helper-shadowing"
  static introducedIn = this.version("unreleased")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "warning"
    }
  }

  get parserOptions(): Partial<ParserOptions> {
    return {
      prism_nodes: true,
      strict_locals: true,
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new NoHelperShadowingVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
