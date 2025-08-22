import { ParserRule } from "../types.js";
import { ARIA_ATTRIBUTES, AttributeVisitorMixin } from "./rule-utils.js";

import type { LintOffense, LintContext } from "../types.js";
import type {HTMLAttributeNode, HTMLOpenTagNode, HTMLSelfCloseTagNode, Node, ParseResult } from "@herb-tools/core";

class AriaAttributeMustBeValid extends AttributeVisitorMixin {
  protected checkStaticAttributeStaticValue(
    attributeName: string, _attributeValue: string, attributeNode: HTMLAttributeNode, _parentNode: HTMLOpenTagNode | HTMLSelfCloseTagNode): void {
    if (!attributeName.startsWith("aria-")) return;

    if (!ARIA_ATTRIBUTES.has(attributeName)){
      this.addOffense(
        `The attribute \`${attributeName}\` is not a valid ARIA attribute. ARIA attributes must match the WAI-ARIA specification.`,
        attributeNode.location,
        "error"
      );
    }
  }

  protected checkStaticAttributeDynamicValue(attributeName: string, _valueNodes: Node[], attributeNode: HTMLAttributeNode, _parentNode: HTMLOpenTagNode | HTMLSelfCloseTagNode, _combinedValue?: string): void {
    if (!attributeName.startsWith("aria-")) return;

    if (!ARIA_ATTRIBUTES.has(attributeName)){
      this.addOffense(
        `The attribute \`${attributeName}\` is not a valid ARIA attribute. ARIA attributes must match the WAI-ARIA specification.`,
        attributeNode.location,
        "error"
      );
    }
  }
}

export class HTMLAriaAttributeMustBeValid extends ParserRule {
  name = "html-aria-attribute-must-be-valid";

  check(result: ParseResult, context?: Partial<LintContext>): LintOffense[] {
    const visitor = new AriaAttributeMustBeValid(this.name, context);

    visitor.visit(result.value);

    return visitor.offenses;
  }
}
