import { BaseRuleVisitor, getTagName, getAttributeName, getAttributeValue, forEachAttribute } from "./rule-utils"
import { ParserRule } from "../types"

import type { ParseResult, HTMLElementNode, HTMLAttributeNode, ERBIfNode, ERBElseNode } from "@herb-tools/core"
import type { LintOffense, LintContext } from "../types"

interface MetaTag {
  node: HTMLElementNode
  nameValue?: string
  httpEquivValue?: string
  controlFlowPath: string[]
}

class MetaNameUniqueVisitor extends BaseRuleVisitor {
  private elementStack: string[] = []
  private metaTags: MetaTag[] = []
  private currentControlFlowPath: string[] = []

  visitHTMLElementNode(node: HTMLElementNode): void {
    const tagName = getTagName(node)?.toLowerCase()
    if (!tagName) return

    if (tagName === "head") {
      this.metaTags = []
    } else if (tagName === "meta" && this.insideHead) {
      this.collectMetaTag(node)
   }

    this.elementStack.push(tagName)
    this.visitChildNodes(node)
    this.elementStack.pop()

    if (tagName === "head") {
      this.checkForDuplicates()
    }
  }

  private get insideHead(): boolean {
    return this.elementStack.includes("head")
  }

  private collectMetaTag(node: HTMLElementNode): void {
    const metaTag: MetaTag = {
      node,
      controlFlowPath: [...this.currentControlFlowPath]
    }

    this.extractAttributes(node, metaTag)

    if (metaTag.nameValue || metaTag.httpEquivValue) {
      this.metaTags.push(metaTag)
    }
  }

  private extractAttributes(node: HTMLElementNode, metaTag: MetaTag): void {
    if (node.type === "AST_HTML_ELEMENT_NODE") {
      const elementNode = node as HTMLElementNode

      if (elementNode.open_tag) {
        forEachAttribute(elementNode.open_tag as any, (attributeNode: HTMLAttributeNode) => {
          this.processAttributeForMetaTag(attributeNode, metaTag)
        })
      }
    }
  }

  private processAttributeForMetaTag(attributeNode: HTMLAttributeNode, metaTag: MetaTag): void {
    const name = getAttributeName(attributeNode)
    const value = getAttributeValue(attributeNode)?.trim()

    if (name === "name" && value) {
      metaTag.nameValue = value
    } else if (name === "http-equiv" && value) {
      metaTag.httpEquivValue = value
    }
  }

  visitERBIfNode(node: ERBIfNode): void {
    const content = (node.content as any)?.value || node.content?.toString() || ""
    const branchName = content.trim().startsWith("elsif") ? "elsif" : "if"

    this.currentControlFlowPath.push(branchName)

    if (node.statements) {
      for (const statement of node.statements) {
        this.visit(statement)
      }
    }

    this.currentControlFlowPath.pop()

    if (node.subsequent) {
      this.visit(node.subsequent)
    }
  }

  visitERBElseNode(node: ERBElseNode): void {
    this.currentControlFlowPath.push("else")

    if (node.statements) {
      for (const statement of node.statements) {
        this.visit(statement)
      }
    }

    this.currentControlFlowPath.pop()
  }

  private checkForDuplicates(): void {
    const nameGroups = this.groupByAttribute('name')
    const httpEquivGroups = this.groupByAttribute('http-equiv')

    nameGroups.forEach((tags) => {
      const originalValue = tags[0].nameValue!
      this.reportConflicts(tags, `\`name="${originalValue}"\``, 'Meta names')
    })

    httpEquivGroups.forEach((tags) => {
      const originalValue = tags[0].httpEquivValue!
      this.reportConflicts(tags, `\`http-equiv="${originalValue}"\``, '`http-equiv` values')
    })
  }

  private groupByAttribute(attributeType: 'name' | 'http-equiv'): Map<string, MetaTag[]> {
    const groups = new Map<string, MetaTag[]>()

    for (const tag of this.metaTags) {
      const value = attributeType === 'name' ? tag.nameValue : tag.httpEquivValue

      if (value) {
        const key = value.toLowerCase()
        if (!groups.has(key)) groups.set(key, [])
        groups.get(key)!.push(tag)
      }
    }

    return groups
  }

  private reportConflicts(tags: MetaTag[], attributeDescription: string, attributeType: string): void {
    if (tags.length < 2) return

    for (let i = 0; i < tags.length - 1; i++) {
      for (let j = i + 1; j < tags.length; j++) {
        if (this.canExecuteInSameContext(tags[i].controlFlowPath, tags[j].controlFlowPath)) {
          this.addOffense(
            `Duplicate \`<meta>\` tag with ${attributeDescription}. ${attributeType} should be unique within the \`<head>\` section.`,
            tags[j].node.location,
            "error"
          )

          return
        }
      }
    }
  }

  private canExecuteInSameContext(pathA: string[], pathB: string[]): boolean {
    if (pathA.length === 0 || pathB.length === 0) return true

    const minLength = Math.min(pathA.length, pathB.length)

    for (let i = 0; i < minLength; i++) {
      if (pathA[i] !== pathB[i]) {
        const [branchA, branchB] = [pathA[i], pathB[i]]
        const mutuallyExclusive = new Set(['if', 'elsif', 'else'])

        return !(mutuallyExclusive.has(branchA) && mutuallyExclusive.has(branchB))
      }
    }

    return true
  }
}

export class HTMLMetaNameMustBeUniqueRule extends ParserRule {
  name = "html-meta-name-must-be-unique"

  check(result: ParseResult, context?: Partial<LintContext>): LintOffense[] {
    const visitor = new MetaNameUniqueVisitor(this.name, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
