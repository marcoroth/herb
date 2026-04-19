import { ParserRule } from "../types.js";
import {
  AttributeVisitorMixin,
  StaticAttributeDynamicValueParams,
  StaticAttributeStaticValueParams,
} from "./rule-utils.js";
import {
  findAttributeByName,
  getAttributes,
  getStaticAttributeValue,
  getTagLocalName,
} from "@herb-tools/core";

import type {
  FullRuleConfig,
  LintContext,
  UnboundLintOffense,
} from "../types.js";
import type {
  HTMLAttributeNode,
  HTMLOpenTagNode,
  ParserOptions,
  ParseResult,
} from "@herb-tools/core";

const TARGET_ATTRIBUTES = new Set(["aria-label", "aria-labelledby"]);
const NAMEABLE_CONTAINER_ELEMENTS = new Set(["div", "span"]);
const NEVER_ALLOWED_ELEMENTS = new Set([
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "strong",
  "i",
  "p",
  "b",
  "code",
]);

const NAME_FROM_PROHIBITED_ROLES = new Set([
  "caption",
  "code",
  "definition",
  "deletion",
  "emphasis",
  "generic",
  "insertion",
  "mark",
  "none",
  "paragraph",
  "presentation",
  "strong",
  "subscript",
  "suggestion",
  "superscript",
  "term",
  "time",
]);

class NoAriaLabelMisuseVisitor extends AttributeVisitorMixin {
  protected checkStaticAttributeStaticValue({
    attributeName,
    attributeNode,
    parentNode,
  }: StaticAttributeStaticValueParams): void {
    this.checkAttributeUsage(attributeName, attributeNode, parentNode);
  }

  protected checkStaticAttributeDynamicValue({
    attributeName,
    attributeNode,
    parentNode,
  }: StaticAttributeDynamicValueParams): void {
    this.checkAttributeUsage(attributeName, attributeNode, parentNode);
  }

  private checkAttributeUsage(
    attributeName: string,
    attributeNode: HTMLAttributeNode,
    node: HTMLOpenTagNode,
  ): void {
    if (!TARGET_ATTRIBUTES.has(attributeName)) return;

    const tagName = getTagLocalName(node);
    if (!tagName) return;

    if (NEVER_ALLOWED_ELEMENTS.has(tagName)) {
      this.addOffense(
        `The \`${attributeName}\` attribute must not be used on the \`<${tagName}>\` element.`,
        attributeNode.location,
      );
      return;
    }

    if (!NAMEABLE_CONTAINER_ELEMENTS.has(tagName)) return;

    const roleAttribute = findAttributeByName(getAttributes(node), "role");
    if (!roleAttribute) {
      this.addOffense(
        `The \`${attributeName}\` attribute on \`<${tagName}>\` requires a permitted ARIA \`role\`.`,
        attributeNode.location,
      );
      return;
    }

    if (this.hasDynamicRole(roleAttribute)) return;

    const roleValue = getStaticAttributeValue(roleAttribute)?.trim()
      .toLowerCase().split(/\s+/)[0];
    if (!roleValue) {
      this.addOffense(
        `The \`${attributeName}\` attribute on \`<${tagName}>\` requires a permitted ARIA \`role\`.`,
        attributeNode.location,
      );
      return;
    }

    if (NAME_FROM_PROHIBITED_ROLES.has(roleValue)) {
      this.addOffense(
        `The \`${attributeName}\` attribute on \`<${tagName}>\` is not allowed with ARIA role \`${roleValue}\` because that role cannot be named.`,
        attributeNode.location,
      );
    }
  }

  private hasDynamicRole(roleAttribute: HTMLAttributeNode): boolean {
    return getStaticAttributeValue(roleAttribute) === null;
  }
}

export class A11yNoAriaLabelMisuseRule extends ParserRule {
  static ruleName = "a11y-no-aria-label-misuse";
  static introducedIn = this.version("unreleased");

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: false,
      severity: "warning",
    };
  }

  get parserOptions(): Partial<ParserOptions> {
    return {
      action_view_helpers: true,
    };
  }

  check(
    result: ParseResult,
    context?: Partial<LintContext>,
  ): UnboundLintOffense[] {
    const visitor = new NoAriaLabelMisuseVisitor(this.ruleName, context);

    visitor.visit(result.value);

    return visitor.offenses;
  }
}
