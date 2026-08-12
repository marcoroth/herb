import {
  PrismVisitor,
  PrismNodes,
  isPrismNodeType,
  locationFromByteOffset,
} from "@herb-tools/core"
import type {
  ParseResult,
  ParserOptions,
  PrismLocation,
} from "@herb-tools/core"

import { ParserRule } from "../types.js"
import type {
  UnboundLintOffense,
  LintContext,
  FullRuleConfig,
} from "../types.js"

const MESSAGE =
  "Avoid defining modules in ERB templates. Move the module to a helper, library, or another appropriate Ruby file."

class ModuleDefinitionCollector extends PrismVisitor {
  readonly definitions: PrismLocation[] = []

  override visitModuleNode(node: PrismNodes.ModuleNode): void {
    this.definitions.push(node.moduleKeywordLoc)
    this.visitChildNodes(node)
  }

  override visitCallNode(node: PrismNodes.CallNode): void {
    if (
      node.name === "new" &&
      isPrismNodeType(node.receiver, "ConstantReadNode") &&
      node.receiver.name === "Module"
    ) {
      this.definitions.push(node.location)
    }

    this.visitChildNodes(node)
  }
}

export class ERBNoModuleDefinitionsRule extends ParserRule {
  static ruleName = "erb-no-module-definitions"
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

  check(
    result: ParseResult,
    _context?: Partial<LintContext>,
  ): UnboundLintOffense[] {
  const source = result.value.source
    if (!source) return []

    const prismNode = result.value.prismNode
    if (!prismNode) return []

    const collector = new ModuleDefinitionCollector()
    collector.visit(prismNode)

    return collector.definitions.map((location) => {
      const { startOffset, length } = location

      return this.createOffense(
        MESSAGE,
        locationFromByteOffset(source, startOffset, length),
      )
    })
  }
}
