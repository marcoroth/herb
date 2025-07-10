import {
  ARIA_ATTRIBUTES,
  AttributeVisitorMixin,
} from "./rule-utils.js";

import type { LintOffense, Rule } from "../types.js";
import type {
  HTMLAttributeNode,
  HTMLOpenTagNode,
  HTMLSelfCloseTagNode,
  Node,
} from "@herb-tools/core";

class AriaAttributeMustBeValid extends AttributeVisitorMixin {
  checkAttribute(
    attributeName: string,
    _attributeValue: string | null,
    attributeNode: HTMLAttributeNode,
    _parentNode: HTMLOpenTagNode | HTMLSelfCloseTagNode,
  ): void {
    if (!attributeName.includes("aria-") return;
      if (!ARIA_ATTRIBUTES.has(attributeName)){
        this.offenses.push({
          message: `The ARIA attribute "${attributeName}" is not valid.`,
          severity: "error",
          location: attributeNode.location,
          rule: this.ruleName,
        });
      }
    }
 
  }
}

export class HTMLAriaAttributeMustBeValid implements Rule {
  name = "html-aria-attribute-must-be-valid";

  check(node: Node): LintOffense[] {
    const visitor = new AriaAttributeMustBeValid(this.name);
    visitor.visit(node);
    return visitor.offenses;
  }
}
