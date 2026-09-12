import { ParserRule } from "../types.js"
import { ElementStackVisitor, isDeprecatedElement } from "../utils/rule-utils.js"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { HTMLOpenTagNode, ERBOpenTagNode, Token, ParseResult, ParserOptions } from "@herb-tools/core"

const FOREIGN_CONTENT_TAGS = ["svg", "math"]

export const OBSOLETE_ELEMENT_REPLACEMENTS: Record<string, string> = {
  acronym: "Use `<abbr>` instead.",
  applet: "Use `<embed>` or `<object>` instead.",
  basefont: "Set the font with CSS instead.",
  bgsound: "Use `<audio>` instead.",
  big: "Set the size with the CSS `font-size` property instead.",
  blink: "Use CSS animations instead.",
  center: "Center the content with CSS instead.",
  dir: "Use `<ul>` instead.",
  font: "Set the font with CSS instead.",
  frame: "Use `<iframe>` instead.",
  frameset: "Lay the page out with CSS and use `<iframe>` for embedded documents instead.",
  isindex: "Use a `<form>` with a text `<input>` instead.",
  keygen: "Use the Web Crypto API instead.",
  listing: "Use `<pre>` instead.",
  marquee: "Use CSS animations instead.",
  menuitem: "Use `<button>` instead.",
  multicol: "Use the CSS multi-column layout properties instead.",
  nextid: "Remove it, it has no replacement.",
  nobr: "Set the CSS `white-space` property to `nowrap` instead.",
  noembed: "Put the fallback content inside `<object>` instead.",
  noframes: "Remove it together with the surrounding `<frameset>`.",
  param: "Set the `data` attribute on `<object>` instead.",
  plaintext: "Use `<pre>` instead.",
  rb: "Put the base text directly inside `<ruby>` instead.",
  rtc: "Use `<rt>` instead.",
  spacer: "Space the content with CSS instead.",
  strike: "Use `<del>` for removed content or `<s>` for content that is no longer accurate instead.",
  tt: "Use `<code>`, `<kbd>`, `<samp>` or `<var>` instead.",
  xmp: "Use `<pre>` with escaped content instead.",
}

class NoObsoleteTagsVisitor extends ElementStackVisitor {
  visitHTMLOpenTagNode(node: HTMLOpenTagNode): void {
    this.checkTagName(node.tag_name)
    super.visitHTMLOpenTagNode(node)
  }

  visitERBOpenTagNode(node: ERBOpenTagNode): void {
    this.checkTagName(node.tag_name)
    super.visitERBOpenTagNode(node)
  }

  private checkTagName(tagNameToken: Token | null): void {
    if (this.isInsideElement(...FOREIGN_CONTENT_TAGS)) return

    const tagName = tagNameToken?.value

    if (!tagName || !isDeprecatedElement(tagName)) return

    const replacement = OBSOLETE_ELEMENT_REPLACEMENTS[tagName.toLowerCase()]

    this.addOffense(
      `\`<${tagName}>\` is an obsolete HTML element. ${replacement}`,
      tagNameToken.location,
      undefined,
      undefined,
      ["deprecated"],
    )
  }
}

export class HTMLNoObsoleteTagsRule extends ParserRule {
  static ruleName = "html-no-obsolete-tags"
  static introducedIn = this.version("unreleased")
  static defaultEnabledIn = this.version("unreleased")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "warning",
    }
  }

  get parserOptions(): Partial<ParserOptions> {
    return {
      action_view_helpers: true,
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new NoObsoleteTagsVisitor(this.ruleName, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
