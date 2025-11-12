import { isHTMLElementNode } from "@herb-tools/core"
import { getTagName, getAttributeName, getAttributeValue, forEachAttribute } from "./rule-utils"

import { ControlFlowTrackingVisitor, ControlFlowType } from "./rule-utils"
import { ParserRule, BaseAutofixContext } from "../types"

import type { ParseResult, HTMLElementNode, HTMLAttributeNode } from "@herb-tools/core"
import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types"

interface MetaTag {
  node: HTMLElementNode
  nameValue?: string
  httpEquivValue?: string
}

interface ControlFlowState {
  previousBranchMetas: MetaTag[]
  previousControlFlowMetas: MetaTag[]
}

interface BranchState {
  previousBranchMetas: MetaTag[]
}

class HTMLNoDuplicateMetaNamesVisitor extends ControlFlowTrackingVisitor<BaseAutofixContext, ControlFlowState, BranchState> {
  private elementStack: string[] = []
  private documentMetas: MetaTag[] = []
  private currentBranchMetas: MetaTag[] = []
  private controlFlowMetas: MetaTag[] = []

  visitHTMLElementNode(node: HTMLElementNode): void {
    const tagName = getTagName(node)?.toLowerCase()
    if (!tagName) return

    if (tagName === "head") {
      this.documentMetas = []
      this.currentBranchMetas = []
      this.controlFlowMetas = []
    } else if (tagName === "meta" && this.insideHead) {
      this.collectAndCheckMetaTag(node)
    }

    this.elementStack.push(tagName)
    this.visitChildNodes(node)
    this.elementStack.pop()
  }

  protected onEnterControlFlow(_controlFlowType: ControlFlowType, wasAlreadyInControlFlow: boolean): ControlFlowState {
    const stateToRestore: ControlFlowState = {
      previousBranchMetas: this.currentBranchMetas,
      previousControlFlowMetas: this.controlFlowMetas
    }

    this.currentBranchMetas = []

    if (!wasAlreadyInControlFlow) {
      this.controlFlowMetas = []
    }

    return stateToRestore
  }

  protected onExitControlFlow(controlFlowType: ControlFlowType, wasAlreadyInControlFlow: boolean, stateToRestore: ControlFlowState): void {
    if (controlFlowType === ControlFlowType.CONDITIONAL && !wasAlreadyInControlFlow) {
      this.controlFlowMetas.forEach(meta => this.documentMetas.push(meta))
    }

    this.currentBranchMetas = stateToRestore.previousBranchMetas
    this.controlFlowMetas = stateToRestore.previousControlFlowMetas
  }

  protected onEnterBranch(): BranchState {
    const stateToRestore: BranchState = {
      previousBranchMetas: this.currentBranchMetas
    }

    if (this.isInControlFlow) {
      this.currentBranchMetas = []
    }

    return stateToRestore
  }

  protected onExitBranch(_stateToRestore: BranchState): void {}

  private get insideHead(): boolean {
    return this.elementStack.includes("head")
  }

  private collectAndCheckMetaTag(node: HTMLElementNode): void {
    const metaTag: MetaTag = { node }
    this.extractAttributes(node, metaTag)

    if (!metaTag.nameValue && !metaTag.httpEquivValue) return

    if (this.isInControlFlow) {
      this.handleControlFlowMeta(metaTag)
    } else {
      this.handleGlobalMeta(metaTag)
    }

    this.currentBranchMetas.push(metaTag)
  }

  private extractAttributes(node: HTMLElementNode, metaTag: MetaTag): void {
    if (isHTMLElementNode(node) && node.open_tag) {
      forEachAttribute(node.open_tag as any, (attributeNode: HTMLAttributeNode) => {
        const name = getAttributeName(attributeNode)
        const value = getAttributeValue(attributeNode)?.trim()

        if (name === "name" && value) {
          metaTag.nameValue = value
        } else if (name === "http-equiv" && value) {
          metaTag.httpEquivValue = value
        }
      })
    }
  }

  private handleControlFlowMeta(metaTag: MetaTag): void {
    if (this.currentControlFlowType === ControlFlowType.LOOP) {
      this.checkAgainstMetaList(metaTag, this.currentBranchMetas, "within the same loop iteration")
    } else {
      this.checkAgainstMetaList(metaTag, this.currentBranchMetas, "within the same control flow branch")
      this.checkAgainstMetaList(metaTag, this.documentMetas, "")

      this.controlFlowMetas.push(metaTag)
    }
  }

  private handleGlobalMeta(metaTag: MetaTag): void {
    this.checkAgainstMetaList(metaTag, this.documentMetas, "")
    this.documentMetas.push(metaTag)
  }

  private checkAgainstMetaList(metaTag: MetaTag, existingMetas: MetaTag[], context: string): void {
    for (const existing of existingMetas) {
      if (this.areMetaTagsDuplicate(metaTag, existing)) {
        const attributeDescription = metaTag.nameValue
          ? `\`name="${metaTag.nameValue}"\``
          : `\`http-equiv="${metaTag.httpEquivValue}"\``

        const attributeType = metaTag.nameValue ? "Meta names" : "`http-equiv` values"

        const contextMsg = context ? ` ${context}` : ""

        this.addOffense(
          `Duplicate \`<meta>\` tag with ${attributeDescription}${contextMsg}. ${attributeType} should be unique within the \`<head>\` section.`,
          metaTag.node.location,
        )

        return
      }
    }
  }

  private areMetaTagsDuplicate(meta1: MetaTag, meta2: MetaTag): boolean {
    if (meta1.nameValue && meta2.nameValue) {
      return meta1.nameValue.toLowerCase() === meta2.nameValue.toLowerCase()
    }

    if (meta1.httpEquivValue && meta2.httpEquivValue) {
      return meta1.httpEquivValue.toLowerCase() === meta2.httpEquivValue.toLowerCase()
    }

    return false
  }
}

export class HTMLNoDuplicateMetaNamesRule extends ParserRule {
  static autocorrectable = false
  name = "html-no-duplicate-meta-names"

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error"
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new HTMLNoDuplicateMetaNamesVisitor(this.name, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
