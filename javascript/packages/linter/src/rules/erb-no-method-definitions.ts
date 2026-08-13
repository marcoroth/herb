import { PrismVisitor, locationFromByteOffset } from "@herb-tools/core"
import type { ParseResult, ParserOptions, PrismNodes } from "@herb-tools/core"

import { ParserRule } from "../types.js"
import type {
  FullRuleConfig,
  LintContext,
  UnboundLintOffense,
} from "../types.js"

type MethodDefinition = {
  name: string
  startOffset: number
  length: number
  definedWith: "def" | "define_method"
}

class MethodDefinitionCollector extends PrismVisitor {
  readonly definitions: MethodDefinition[] = []

  override visitDefNode(node: PrismNodes.DefNode): void {
    const { startOffset, length } = node.defKeywordLoc

    this.definitions.push({
      name: node.name,
      startOffset,
      length,
      definedWith: "def",
    })
    this.visitChildNodes(node)
  }

  override visitCallNode(node: PrismNodes.CallNode): void {
    if (node.name === "define_method") {
      const location = node.messageLoc ?? node.location

      this.definitions.push({
        name: node.name,
        startOffset: location.startOffset,
        length: location.length,
        definedWith: "define_method",
      })
    }

    this.visitChildNodes(node)
  }
}

export class ERBNoMethodDefinitionsRule extends ParserRule {
  static ruleName = "erb-no-method-definitions"
  static introducedIn = this.version("unreleased")
  static consumesParserErrors = true

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

    const collector = new MethodDefinitionCollector()
    collector.visit(program)

    return collector.definitions.map((definition) => {
      return this.createOffense(
        definition.definedWith === "def"
          ? `Avoid defining methods in ERB templates. Move \`${definition.name}\` to a helper, presenter, or view component.`
          : "Avoid defining methods in ERB templates. Move this `define_method` call to a helper, presenter, or view component.",
        locationFromByteOffset(source, definition.startOffset, definition.length),
      )
    })
  }
}
