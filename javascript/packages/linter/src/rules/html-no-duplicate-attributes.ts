import { ParserRule, BaseAutofixContext } from "../types.js"
import { ControlFlowTrackingVisitor, ControlFlowType, getAttributeName } from "./rule-utils.js"

import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types.js"
import type { HTMLOpenTagNode, HTMLAttributeNode, ParseResult, Location } from "@herb-tools/core"

interface ControlFlowState {
  previousBranchAttributes: Set<string>
  previousControlFlowAttributes: Set<string>
}

interface BranchState {
  previousBranchAttributes: Set<string>
}

class NoDuplicateAttributesVisitor extends ControlFlowTrackingVisitor<
  BaseAutofixContext,
  ControlFlowState,
  BranchState
> {
  private tagAttributes = new Set<string>()
  private currentBranchAttributes = new Set<string>()
  private controlFlowAttributes = new Set<string>()

  visitHTMLOpenTagNode(node: HTMLOpenTagNode): void {
    this.tagAttributes = new Set()
    this.currentBranchAttributes = new Set()
    this.controlFlowAttributes = new Set()
    super.visitHTMLOpenTagNode(node)
  }

  visitHTMLAttributeNode(node: HTMLAttributeNode): void {
    this.checkAttribute(node)
  }

  protected onEnterControlFlow(_controlFlowType: ControlFlowType, wasAlreadyInControlFlow: boolean): ControlFlowState {
    const stateToRestore: ControlFlowState = {
      previousBranchAttributes: this.currentBranchAttributes,
      previousControlFlowAttributes: this.controlFlowAttributes,
    }

    this.currentBranchAttributes = new Set()

    if (!wasAlreadyInControlFlow) {
      this.controlFlowAttributes = new Set()
    }

    return stateToRestore
  }

  protected onExitControlFlow(
    controlFlowType: ControlFlowType,
    wasAlreadyInControlFlow: boolean,
    stateToRestore: ControlFlowState,
  ): void {
    if (controlFlowType === ControlFlowType.CONDITIONAL && !wasAlreadyInControlFlow) {
      this.controlFlowAttributes.forEach((attr) => this.tagAttributes.add(attr))
    }

    this.currentBranchAttributes = stateToRestore.previousBranchAttributes
    this.controlFlowAttributes = stateToRestore.previousControlFlowAttributes
  }

  protected onEnterBranch(): BranchState {
    const stateToRestore: BranchState = {
      previousBranchAttributes: this.currentBranchAttributes,
    }

    if (this.isInControlFlow) {
      this.currentBranchAttributes = new Set()
    }

    return stateToRestore
  }

  protected onExitBranch(_stateToRestore: BranchState): void {}

  private checkAttribute(attributeNode: HTMLAttributeNode): void {
    const identifier = getAttributeName(attributeNode)
    if (!identifier) return

    this.processAttributeDuplicate(identifier, attributeNode)
  }

  private processAttributeDuplicate(identifier: string, attributeNode: HTMLAttributeNode): void {
    if (!this.isInControlFlow) {
      this.handleHTMLAttribute(identifier, attributeNode)
      return
    }

    if (this.currentControlFlowType === ControlFlowType.LOOP) {
      this.handleLoopAttribute(identifier, attributeNode)
    } else {
      this.handleConditionalAttribute(identifier, attributeNode)
    }

    this.currentBranchAttributes.add(identifier)
  }

  private handleHTMLAttribute(identifier: string, attributeNode: HTMLAttributeNode): void {
    if (this.tagAttributes.has(identifier)) {
      this.addDuplicateAttributeOffense(identifier, attributeNode.name!.location)
    }

    this.tagAttributes.add(identifier)
  }

  private handleLoopAttribute(identifier: string, attributeNode: HTMLAttributeNode): void {
    if (this.currentBranchAttributes.has(identifier)) {
      this.addSameLoopIterationOffense(identifier, attributeNode.name!.location)
      return
    }

    if (this.tagAttributes.has(identifier)) {
      this.addDuplicateAttributeOffense(identifier, attributeNode.name!.location)
    }
  }

  private handleConditionalAttribute(identifier: string, attributeNode: HTMLAttributeNode): void {
    if (this.currentBranchAttributes.has(identifier)) {
      this.addSameBranchOffense(identifier, attributeNode.name!.location)
      return
    }

    if (this.tagAttributes.has(identifier)) {
      this.addDuplicateAttributeOffense(identifier, attributeNode.name!.location)
    }
  }

  private addDuplicateAttributeOffense(identifier: string, location: Location): void {
    this.addOffense(`Duplicate attribute \`${identifier}\` found on tag. Remove the duplicate occurrence.`, location)
  }

  private addSameLoopIterationOffense(identifier: string, location: Location): void {
    this.addOffense(
      `Duplicate attribute \`${identifier}\` found within the same loop iteration. Attributes must be unique within the same loop iteration.`,
      location,
    )
  }

  private addSameBranchOffense(identifier: string, location: Location): void {
    this.addOffense(
      `Duplicate attribute \`${identifier}\` found within the same control flow branch. Attributes must be unique within the same control flow branch.`,
      location,
    )
  }
}

export class HTMLNoDuplicateAttributesRule extends ParserRule {
  name = "html-no-duplicate-attributes"

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error"
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new NoDuplicateAttributesVisitor(this.name, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
