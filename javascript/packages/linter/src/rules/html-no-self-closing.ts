import { BaseRuleVisitor, getTagName } from "./rule-utils.js";

import { ParserRule } from "../types.js";
import type { LintContext, LintOffense } from "../types.js";
import type { HTMLOpenTagNode, ParseResult } from "@herb-tools/core";

class NoSelfClosingVisitor extends BaseRuleVisitor {
  visitHTMLOpenTagNode(node: HTMLOpenTagNode): void {
    if (node.tag_closing?.value === "/>") {
      const tagName = getTagName(node);
      this.offenses.push({
        message:
          `Self-closing syntax ("<${tagName} />") is not allowed in HTML. Use "<${tagName}>" or "<${tagName}></${tagName}>" instead.`,
        severity: "error",
        location: node.location,
        rule: this.ruleName,
      });
    }
    super.visitHTMLOpenTagNode(node);
  }
}

export class HTMLNoSelfClosingRule extends ParserRule {
  name = "html-no-self-closing";

  check(result: ParseResult, context?: Partial<LintContext>): LintOffense[] {
    const visitor = new NoSelfClosingVisitor(this.name, context);
    visitor.visit(result.value);
    return visitor.offenses;
  }
}
