import { BaseRuleVisitor, getTagName, getAttributeValue, findAttributeByName, getAttributes } from "./rule-utils.js"

import type { Rule, LintOffense } from "../types.js"
import type { HTMLOpenTagNode, HTMLSelfCloseTagNode, Node } from "@herb-tools/core"

class ERBPreferImageTagHelperVisitor extends BaseRuleVisitor {
  visitHTMLOpenTagNode(node: HTMLOpenTagNode): void {
    this.checkImgTag(node)
    super.visitHTMLOpenTagNode(node)
  }

  visitHTMLSelfCloseTagNode(node: HTMLSelfCloseTagNode): void {
    this.checkImgTag(node)
    super.visitHTMLSelfCloseTagNode(node)
  }

  private checkImgTag(node: HTMLOpenTagNode | HTMLSelfCloseTagNode): void {
    const tagName = getTagName(node)

    if (tagName !== "img") {
      return
    }

    const attributes = getAttributes(node)
    const srcAttribute = findAttributeByName(attributes, "src")

    if (!srcAttribute) {
      return
    }

    const srcValue = getAttributeValue(srcAttribute)

    if (srcValue && this.containsImagePathHelper(srcValue)) {
      this.addOffense(
        'Prefer `image_tag` helper over manual `<img>` with Rails URL helpers. Use `<%= image_tag "filename.png", alt: "description" %>` instead.',
        node.tag_name!.location,
        "warning"
      )
    }
  }

  private containsImagePathHelper(srcValue: string): boolean {
    const patterns = [
      /<%=\s*image_path\s*\(/,
      /<%=\s*asset_path\s*\(/,
      /<%=\s*Rails\.application\.routes\.url_helpers\./,
      /<%=\s*root_url/,
      /<%=\s*root_path/,
      /<%=\s*.*_url.*\//,
      /<%=\s*.*_path.*\//
    ]

    return patterns.some(pattern => pattern.test(srcValue))
  }
}

export class ERBPreferImageTagHelperRule implements Rule {
  name = "erb-prefer-image-tag-helper"

  check(node: Node): LintOffense[] {
    const visitor = new ERBPreferImageTagHelperVisitor(this.name)
    visitor.visit(node)
    return visitor.offenses
  }
}
