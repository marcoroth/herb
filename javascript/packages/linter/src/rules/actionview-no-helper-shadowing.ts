import { ParserRule } from "../types.js"
import { BaseRuleVisitor } from "./rule-utils.js"
import { PrismVisitor } from "@herb-tools/core"

import { getHelperEntries, isRubyParameterNode, isPrismNodeType, locationFromByteOffset } from "@herb-tools/core"

import type { UnboundLintOffense, LintContext, FullRuleConfig, LintSeverity } from "../types.js"

import type {
  ParseResult,
  ParserOptions,
  ERBBlockNode,
  ERBIterationBlockNode,
  ERBRenderNode,
  ERBStrictLocalsNode,
  ERBContentNode,
  ERBForNode,
  Node,
  PrismNode,
  Location,
} from "@herb-tools/core"

const ALL_HELPER_NAMES = new Set(getHelperEntries().filter(helper => helper.visibility === "public").flatMap(helper => [helper.name, ...helper.aliases]))
const TRANSFORMED_HELPER_NAMES = new Set(getHelperEntries().filter(helper => helper.supported).flatMap(helper => [helper.name, ...helper.aliases]))

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

  visitERBIterationBlockNode(node: ERBIterationBlockNode): void {
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
    this.collectLocalBindings(node.prismNode, node.source)
    this.visitChildNodes(node)
  }

  visitERBForNode(node: ERBForNode): void {
    const { prismNode } = node

    if (prismNode && isPrismNodeType(prismNode, "ForNode")) {
      this.collectLocalBindings(prismNode.index, node.source)
    }

    this.visitChildNodes(node)
  }

  private report(name: string, location: Location): void {
    if (!ALL_HELPER_NAMES.has(name)) return

    const severity: LintSeverity | undefined = TRANSFORMED_HELPER_NAMES.has(name) ? undefined : "hint"

    this.addOffense(shadowingMessage(name), location, undefined, severity)
  }

  private checkParameters(parameters: Node[] | null | undefined): void {
    if (!parameters) return

    for (const parameter of parameters) {
      if (!isRubyParameterNode(parameter)) continue

      const name = parameter.name?.value

      if (name) this.report(name, parameter.name!.location)
    }
  }

  private collectLocalBindings(prismNode: PrismNode | null, source: string | null): void {
    if (!prismNode || !source) return

    const collector = new LocalBindingCollector()
    collector.visit(prismNode)

    for (const binding of collector.bindings) {
      this.report(binding.name, locationFromByteOffset(source, binding.startOffset, binding.length))
    }
  }
}

export class ActionViewNoHelperShadowingRule extends ParserRule {
  static ruleName = "actionview-no-helper-shadowing"
  static introducedIn = this.version("unreleased")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error"
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
