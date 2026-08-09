import { ParserRule } from "../types.js"
import { ElementStackVisitor } from "./rule-utils.js"

import type {
  UnboundLintOffense,
  LintContext,
  FullRuleConfig,
} from "../types.js"
import type {
  HTMLOpenTagNode,
  ERBOpenTagNode,
  Token,
  ParseResult,
  ParserOptions,
} from "@herb-tools/core"

const DEPRECATED_SVG_ELEMENTS = new Set([
  "altglyph",
  "altglyphdef",
  "altglyphitem",
  "cursor",
  "font",
  "font-face",
  "font-face-format",
  "font-face-name",
  "font-face-src",
  "font-face-uri",
  "glyph",
  "glyphref",
  "hkern",
  "missing-glyph",
  "tref",
  "vkern",
])

class SVGNoDeprecatedTagsVisitor extends ElementStackVisitor {
  visitHTMLOpenTagNode(node: HTMLOpenTagNode): void {
    this.checkTagName(node.tag_name)
    super.visitHTMLOpenTagNode(node)
  }

  visitERBOpenTagNode(node: ERBOpenTagNode): void {
    this.checkTagName(node.tag_name)
    super.visitERBOpenTagNode(node)
  }

  private checkTagName(tagNameToken: Token | null): void {
    if (this.isInsideElementAcrossCallers("svg") !== "always") return

    const tagName = tagNameToken?.value
    if (!tagName || !DEPRECATED_SVG_ELEMENTS.has(tagName.toLowerCase())) return

    this.addOffense(
      `SVG element \`<${tagName}>\` is deprecated and no longer supported in modern browsers.`,
      tagNameToken.location,
      undefined,
      undefined,
      ["deprecated"],
    )
  }
}

export class SVGNoDeprecatedTagsRule extends ParserRule {
  static ruleName = "svg-no-deprecated-tags"
  static introducedIn = this.version("unreleased")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error",
    }
  }

  get parserOptions(): Partial<ParserOptions> {
    return {
      action_view_helpers: true,
    }
  }

  check(
    result: ParseResult,
    context?: Partial<LintContext>,
  ): UnboundLintOffense[] {
    const visitor = new SVGNoDeprecatedTagsVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
