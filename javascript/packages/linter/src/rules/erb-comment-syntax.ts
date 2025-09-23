import { BaseRuleVisitor } from "./rule-utils.js";
import { ParserRule } from "../types.js";
import type { LintOffense, LintContext } from "../types.js";
import type { ParseResult, ERBContentNode } from "@herb-tools/core";

class ERBCommentSyntaxVisitor extends BaseRuleVisitor {
  visitERBContentNode(node: ERBContentNode): void {
    this.visitChildNodes(node);

    if (!node.parsed) {
      return;
    }

    if (node.content?.value.startsWith(" #")) {
      const openingTag = node.tag_opening?.value;
      const correctERBTag = openingTag === "<%=" ? "<%#=" : "<%#";
      this.addOffense(
        `Bad ERB comment syntax. Should be ${correctERBTag} without a space between.\nLeaving a space between ERB tags and the Ruby comment character can cause parser errors.`, 
        node.location
      );
    }
  }
}

export class ERBCommentSyntax extends ParserRule {
  name = "erb-comment-syntax";

  check(result: ParseResult, context?: Partial<LintContext>): LintOffense[] {
    const visitor = new ERBCommentSyntaxVisitor(this.name, context);

    visitor.visit(result.value)

    return visitor.offenses
  }
}
