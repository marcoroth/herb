import {
  PrismVisitor,
  PrismNodes,
  locationFromByteOffset,
} from "@herb-tools/core"
import type { ParseResult, ParserOptions } from "@herb-tools/core"

import { ParserRule } from "../types.js"
import type {
  FullRuleConfig,
  LintContext,
  UnboundLintOffense,
} from "../types.js"

class ClassDefinitionCollector extends PrismVisitor {
  readonly classDefinitions: PrismNodes.ClassNode[] = []

  override visitClassNode(node: PrismNodes.ClassNode): void {
    this.classDefinitions.push(node)
    this.visitChildNodes(node)
  }
}

export class ERBNoClassDefinitionsRule extends ParserRule {
  static ruleName = "erb-no-class-definitions"
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

    const program = result.value.prismNode
    if (!program) return []

    const collector = new ClassDefinitionCollector()
    collector.visit(program)

    return collector.classDefinitions.map((classDefinition) => {
      const { startOffset, length } = classDefinition.classKeywordLoc

      return this.createOffense(
        "Avoid defining classes in ERB templates. Move this class to a model, helper, or view object.",
        locationFromByteOffset(source, startOffset, length),
      )
    })
  }
}
