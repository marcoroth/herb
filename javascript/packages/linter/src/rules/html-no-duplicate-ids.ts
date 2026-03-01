import { ParserRule, BaseAutofixContext } from "../types"
import { ControlFlowTrackingVisitor, ControlFlowType } from "./rule-utils"
import { LiteralNode } from "@herb-tools/core"
import { Printer, IdentityPrinter } from "@herb-tools/printer"

import { hasERBOutput, getValidatableStaticContent, isEffectivelyStatic, isNode, getStaticAttributeName, isERBOutputNode } from "@herb-tools/core"

import type { ParseResult, HTMLAttributeNode, ERBContentNode } from "@herb-tools/core"
import type { UnboundLintOffense, LintContext, FullRuleConfig } from "../types"

interface ControlFlowState {
  previousBranchIds: Set<string>
  previousControlFlowIds: Set<string>
}

interface BranchState {
  previousBranchIds: Set<string>
}

class OutputPrinter extends Printer {
  visitLiteralNode(node: LiteralNode) {
    this.write(IdentityPrinter.print(node))
  }

  visitERBContentNode(node: ERBContentNode) {
    if (isERBOutputNode(node)) {
      this.write(IdentityPrinter.print(node))
    }
  }
}

class NoDuplicateIdsVisitor extends ControlFlowTrackingVisitor<BaseAutofixContext, ControlFlowState, BranchState> {
  private documentIds: Set<string> = new Set<string>()
  private currentBranchIds: Set<string> = new Set<string>()
  private controlFlowIds: Set<string> = new Set<string>()

  visitHTMLAttributeNode(node: HTMLAttributeNode): void {
    this.checkAttribute(node)
  }

  protected onEnterControlFlow(_controlFlowType: ControlFlowType, wasAlreadyInControlFlow: boolean): ControlFlowState {
    const stateToRestore: ControlFlowState = {
      previousBranchIds: this.currentBranchIds,
      previousControlFlowIds: this.controlFlowIds
    }

    this.currentBranchIds = new Set<string>()

    if (!wasAlreadyInControlFlow) {
      this.controlFlowIds = new Set<string>()
    }

    return stateToRestore
  }

  protected onExitControlFlow(controlFlowType: ControlFlowType, wasAlreadyInControlFlow: boolean, stateToRestore: ControlFlowState): void {
    if (controlFlowType === ControlFlowType.CONDITIONAL && !wasAlreadyInControlFlow) {
      this.controlFlowIds.forEach(id => this.documentIds.add(id))
    }

    this.currentBranchIds = stateToRestore.previousBranchIds
    this.controlFlowIds = stateToRestore.previousControlFlowIds
  }

  protected onEnterBranch(): BranchState {
    const stateToRestore: BranchState = {
      previousBranchIds: this.currentBranchIds
    }

    if (this.isInControlFlow) {
      this.currentBranchIds = new Set<string>()
    }

    return stateToRestore
  }

  protected onExitBranch(_stateToRestore: BranchState): void {}

  private checkAttribute(attributeNode: HTMLAttributeNode): void {
    if (!this.isIdAttribute(attributeNode)) return

    const idValue = this.extractIdValue(attributeNode)

    if (!idValue) return
    if (this.isWhitespaceOnlyId(idValue.identifier)) return

    this.processIdDuplicate(idValue, attributeNode)
  }

  private isIdAttribute(attributeNode: HTMLAttributeNode): boolean {
    if (!attributeNode.name?.children || !attributeNode.value) return false

    return getStaticAttributeName(attributeNode.name) === "id"
  }

  private extractIdValue(attributeNode: HTMLAttributeNode): { identifier: string; shouldTrackDuplicates: boolean } | null {
    const valueNodes = attributeNode.value?.children || []

    if (hasERBOutput(valueNodes) && this.isInControlFlow && this.currentControlFlowType === ControlFlowType.LOOP) {
      return null
    }

    const identifier = isEffectivelyStatic(valueNodes) ? getValidatableStaticContent(valueNodes) : OutputPrinter.print(valueNodes)
    if (!identifier) return null

    return { identifier, shouldTrackDuplicates: true }
  }

  private isWhitespaceOnlyId(identifier: string): boolean {
    return identifier !== '' && identifier.trim() === ''
  }

  private processIdDuplicate(idValue: { identifier: string; shouldTrackDuplicates: boolean }, attributeNode: HTMLAttributeNode): void {
    const { identifier, shouldTrackDuplicates } = idValue

    if (!shouldTrackDuplicates) return

    if (this.isInControlFlow) {
      this.handleControlFlowId(identifier, attributeNode)
    } else {
      this.handleGlobalId(identifier, attributeNode)
    }
  }

  private handleControlFlowId(identifier: string, attributeNode: HTMLAttributeNode): void {
    if (this.currentControlFlowType === ControlFlowType.LOOP) {
      this.handleLoopId(identifier, attributeNode)
    } else {
      this.handleConditionalId(identifier, attributeNode)
    }

    this.currentBranchIds.add(identifier)
  }

  private handleLoopId(identifier: string, attributeNode: HTMLAttributeNode): void {
    const isStaticId = this.isStaticId(attributeNode)

    if (isStaticId) {
      this.addDuplicateIdOffense(identifier, attributeNode.location)
      return
    }

    if (this.currentBranchIds.has(identifier)) {
      this.addSameLoopIterationOffense(identifier, attributeNode.location)
    }
  }

  private handleConditionalId(identifier: string, attributeNode: HTMLAttributeNode): void {
    if (this.currentBranchIds.has(identifier)) {
      this.addSameBranchOffense(identifier, attributeNode.location)
      return
    }

    if (this.documentIds.has(identifier)) {
      this.addDuplicateIdOffense(identifier, attributeNode.location)
      return
    }

    this.controlFlowIds.add(identifier)
  }

  private handleGlobalId(identifier: string, attributeNode: HTMLAttributeNode): void {
    if (this.documentIds.has(identifier)) {
      this.addDuplicateIdOffense(identifier, attributeNode.location)
      return
    }

    this.documentIds.add(identifier)
  }

  private isStaticId(attributeNode: HTMLAttributeNode): boolean {
    const valueNodes = attributeNode.value!.children
    const isCompletelyStatic = valueNodes.every(child => isNode(child, LiteralNode))
    const isEffectivelyStaticValue = isEffectivelyStatic(valueNodes)

    return isCompletelyStatic || isEffectivelyStaticValue
  }

  private addDuplicateIdOffense(identifier: string, location: any): void {
    this.addOffense(
      `Duplicate ID \`${identifier}\` found. IDs must be unique within a document.`,
      location,
    )
  }

  private addSameLoopIterationOffense(identifier: string, location: any): void {
    this.addOffense(
      `Duplicate ID \`${identifier}\` found within the same loop iteration. IDs must be unique within the same loop iteration.`,
      location,
    )
  }

  private addSameBranchOffense(identifier: string, location: any): void {
    this.addOffense(
      `Duplicate ID \`${identifier}\` found within the same control flow branch. IDs must be unique within the same control flow branch.`,
      location,
    )
  }
}

export class HTMLNoDuplicateIdsRule extends ParserRule {
  name = "html-no-duplicate-ids"

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error"
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new NoDuplicateIdsVisitor(this.name, context)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
