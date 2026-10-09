import { ParserRule, BaseAutofixContext } from "../types"
import { ControlFlowTrackingVisitor, ControlFlowType } from "../utils/rule-utils.js"
import { Printer, IdentityPrinter } from "@herb-tools/printer"

import { PrismVisitor, isPrismNodeType, hasDynamicOutput, getValidatableStaticContent, getStaticAttributeName, isERBOutputNode, isRubyLiteralNode, isRubyParameterNode, isHTMLElementNode, isKnownHTMLElement, getTagName, getTagLocalName } from "@herb-tools/core"

import type * as Nodes from "@herb-tools/core"
import type { ParseResult, HTMLAttributeNode, HTMLElementNode, LiteralNode, ERBContentNode, RubyLiteralNode, ParserOptions, PrismNodes } from "@herb-tools/core"
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

  visitRubyLiteralNode(node: RubyLiteralNode) {
    this.write(`#{${IdentityPrinter.print(node)}}`)
  }
}

class LoopDerivedNamesVisitor extends PrismVisitor {
  private readonly assignments: { node: PrismNodes.LocalVariableWriteNode, scopeStart: number }[] = []
  private scopeStart = 0

  override visitLocalVariableWriteNode(node: PrismNodes.LocalVariableWriteNode): void {
    this.visit(node.value)
    this.assignments.push({ node, scopeStart: this.scopeStart })
  }

  override visitBlockNode(node: PrismNodes.BlockNode): void {
    this.visitScope(node)
  }

  override visitLambdaNode(node: PrismNodes.LambdaNode): void {
    this.visitScope(node)
  }

  override visitDefNode(): void {}
  override visitClassNode(): void {}
  override visitModuleNode(): void {}
  override visitSingletonClassNode(): void {}

  track(node: ERBContentNode, names: string[]): void {
    const range = node.content?.range

    if (!range) return

    for (const { node: assignment, scopeStart } of this.assignments) {
      const { startOffset, length } = assignment.location

      // A block or lambda opened inside this tag has its own local variables.
      if (scopeStart >= range.from || startOffset < range.from || startOffset + length > range.to) continue

      if (!names.includes(assignment.name) && this.referencesLoopVariable(assignment.value, names)) {
        names.push(assignment.name)
      }
    }
  }

  private visitScope(node: PrismNodes.BlockNode | PrismNodes.LambdaNode): void {
    const previous = this.scopeStart

    this.scopeStart = node.location.startOffset
    this.visitChildNodes(node)
    this.scopeStart = previous
  }

  private referencesLoopVariable(node: PrismNodes.Node, names: string[], depth = 0): boolean {
    if (isPrismNodeType(node, "LocalVariableReadNode")) {
      return node.depth >= depth && names.includes(node.name)
    }

    if (isPrismNodeType(node, "ItLocalVariableReadNode")) {
      return depth === 0 && names.includes("it")
    }

    if (isPrismNodeType(node, "DefNode") || isPrismNodeType(node, "ClassNode") || isPrismNodeType(node, "ModuleNode") || isPrismNodeType(node, "SingletonClassNode")) return false

    const childDepth = isPrismNodeType(node, "BlockNode") || isPrismNodeType(node, "LambdaNode") ? depth + 1 : depth

    return node.childNodes().some(child => child !== null && this.referencesLoopVariable(child, names, childDepth))
  }
}

class NoDuplicateIdsVisitor extends ControlFlowTrackingVisitor<BaseAutofixContext, ControlFlowState, BranchState> {
  private documentIds: Set<string> = new Set<string>()
  private currentBranchIds: Set<string> = new Set<string>()
  private controlFlowIds: Set<string> = new Set<string>()
  private loopVariableScopes: string[][] = []

  private static readonly IMPLICIT_BLOCK_PARAMETERS = ["it", "_1", "_2", "_3", "_4", "_5", "_6", "_7", "_8", "_9"]

  constructor(ruleName: string, context: Partial<LintContext> | undefined, private readonly loopDerivedNames: LoopDerivedNamesVisitor) {
    super(ruleName, context)
  }

  visitHTMLElementNode(node: HTMLElementNode): void {
    if (getTagLocalName(node) === "template") {
      this.visitTemplateElementNode(node)

      return
    }

    const fallbacks = this.fallbackChildren(node)

    if (fallbacks.length > 0) {
      this.visitElementWithFallbacks(node, fallbacks)

      return
    }

    super.visitHTMLElementNode(node)
  }

  private fallbackChildren(node: HTMLElementNode): HTMLElementNode[] {
    const name = getTagName(node)

    if (!name || !/^[A-Z]/.test(name) || isKnownHTMLElement(name.toLowerCase())) return []

    return node.body.filter((child): child is HTMLElementNode => isHTMLElementNode(child) && getTagName(child) === "Fallback")
  }

  private visitElementWithFallbacks(node: HTMLElementNode, fallbacks: HTMLElementNode[]): void {
    this.handleControlFlowNode(node, ControlFlowType.CONDITIONAL, () => {
      if (node.open_tag) this.visit(node.open_tag)

      for (const child of node.body) {
        if (!fallbacks.includes(child as HTMLElementNode)) this.visit(child)
      }

      for (const fallback of fallbacks) {
        this.startNewBranch(() => super.visitHTMLElementNode(fallback))
      }

      if (node.close_tag) this.visit(node.close_tag)
    })
  }

  visitHTMLAttributeNode(node: HTMLAttributeNode): void {
    this.checkAttribute(node)
  }

  visitERBIterationBlockNode(node: Nodes.ERBIterationBlockNode): void {
    const declared = node.block_arguments
      .filter(isRubyParameterNode)
      .map(argument => argument.name?.value)
      .filter((name): name is string => Boolean(name))

    const names = declared.length > 0 ? declared : [...NoDuplicateIdsVisitor.IMPLICIT_BLOCK_PARAMETERS]

    this.loopVariableScopes.push(names)
    super.visitERBIterationBlockNode(node)
    this.loopVariableScopes.pop()
  }

  visitERBContentNode(node: ERBContentNode): void {
    this.trackLoopDerivedNames(node)

    super.visitERBContentNode(node)
  }

  private trackLoopDerivedNames(node: ERBContentNode): void {
    const names = this.loopVariableScopes[this.loopVariableScopes.length - 1]

    if (!names || names.length === 0 || isERBOutputNode(node)) return

    this.loopDerivedNames.track(node, names)
  }

  private variesPerIteration(attributeNode: HTMLAttributeNode): boolean {
    const names = this.loopVariableScopes[this.loopVariableScopes.length - 1] ?? []

    if (names.length === 0) return false

    return (attributeNode.value?.children ?? []).some(child => {
      let code: string | null = null

      if (isERBOutputNode(child)) code = (child as ERBContentNode).content?.value ?? ""
      if (isRubyLiteralNode(child)) code = (child as RubyLiteralNode).content ?? ""

      if (code === null) return false

      return names.some(name => new RegExp(`(?<![A-Za-z0-9_])${name}(?![A-Za-z0-9_])`).test(code!))
    })
  }

  private visitTemplateElementNode(node: HTMLElementNode): void {
    if (node.open_tag) this.visit(node.open_tag)

    const previousDocumentIds = this.documentIds
    const previousBranchIds = this.currentBranchIds
    const previousControlFlowIds = this.controlFlowIds
    const previousIsInControlFlow = this.isInControlFlow
    const previousControlFlowType = this.currentControlFlowType

    this.documentIds = new Set<string>()
    this.currentBranchIds = new Set<string>()
    this.controlFlowIds = new Set<string>()

    this.isInControlFlow = false
    this.currentControlFlowType = null

    for (const child of node.body) {
      this.visit(child)
    }

    this.documentIds = previousDocumentIds
    this.currentBranchIds = previousBranchIds
    this.controlFlowIds = previousControlFlowIds
    this.isInControlFlow = previousIsInControlFlow
    this.currentControlFlowType = previousControlFlowType

    if (node.close_tag) this.visit(node.close_tag)
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

  private extractIdValue(attributeNode: HTMLAttributeNode): { identifier: string; shouldTrackDuplicates: boolean; isDynamic: boolean } | null {
    const valueNodes = attributeNode.value?.children || []
    const isDynamic = hasDynamicOutput(valueNodes)

    const identifier = isDynamic ? OutputPrinter.print(valueNodes) : getValidatableStaticContent(valueNodes)
    if (!identifier) return null

    return { identifier, shouldTrackDuplicates: true, isDynamic }
  }

  private isWhitespaceOnlyId(identifier: string): boolean {
    return identifier !== '' && identifier.trim() === ''
  }

  private processIdDuplicate(idValue: { identifier: string; shouldTrackDuplicates: boolean; isDynamic: boolean }, attributeNode: HTMLAttributeNode): void {
    const { identifier, shouldTrackDuplicates, isDynamic } = idValue

    if (!shouldTrackDuplicates) return

    if (this.isInControlFlow) {
      this.handleControlFlowId(identifier, attributeNode, isDynamic)
    } else {
      this.handleGlobalId(identifier, attributeNode, isDynamic)
    }
  }

  private handleControlFlowId(identifier: string, attributeNode: HTMLAttributeNode, isDynamic: boolean): void {
    if (this.currentControlFlowType === ControlFlowType.LOOP) {
      this.handleLoopId(identifier, attributeNode, isDynamic)
    } else {
      this.handleConditionalId(identifier, attributeNode, isDynamic)
    }

    this.currentBranchIds.add(identifier)
  }

  private handleLoopId(identifier: string, attributeNode: HTMLAttributeNode, isDynamic: boolean): void {
    if (this.currentBranchIds.has(identifier)) {
      this.addSameLoopIterationOffense(identifier, attributeNode.location, isDynamic)

      return
    }

    if (!isDynamic) {
      this.addDuplicateIdOffense(identifier, attributeNode.location)

      return
    }

    if (this.loopVariableScopes.length > 0 && !this.variesPerIteration(attributeNode)) {
      this.addDuplicateIdOffense(identifier, attributeNode.location)
    }
  }

  private handleConditionalId(identifier: string, attributeNode: HTMLAttributeNode, isDynamic: boolean): void {
    if (this.currentBranchIds.has(identifier)) {
      this.addSameBranchOffense(identifier, attributeNode.location, isDynamic)

      return
    }

    if (!isDynamic && this.documentIds.has(identifier)) {
      this.addDuplicateIdOffense(identifier, attributeNode.location)

      return
    }

    if (!isDynamic) {
      this.controlFlowIds.add(identifier)
    }
  }

  private handleGlobalId(identifier: string, attributeNode: HTMLAttributeNode, isDynamic: boolean): void {
    if (this.documentIds.has(identifier)) {
      if (isDynamic) {
        this.addPotentialDuplicateIdOffense(identifier, attributeNode.location)
      } else {
        this.addDuplicateIdOffense(identifier, attributeNode.location)
      }

      return
    }

    this.documentIds.add(identifier)
  }

  private addDuplicateIdOffense(identifier: string, location: any): void {
    this.addOffense(
      `Duplicate ID \`${identifier}\` found. IDs must be unique within a document.`,
      location,
    )
  }

  private addSameLoopIterationOffense(identifier: string, location: any, isDynamic: boolean): void {
    if (isDynamic) {
      this.addOffense(
        `Potential duplicate ID \`${identifier}\` found within the same loop iteration. If this expression evaluates to the same value, IDs must be unique.`,
        location,
        undefined,
        "hint",
      )

      return
    }

    this.addOffense(
      `Duplicate ID \`${identifier}\` found within the same loop iteration. IDs must be unique within the same loop iteration.`,
      location,
    )
  }

  private addSameBranchOffense(identifier: string, location: any, isDynamic: boolean): void {
    if (isDynamic) {
      this.addOffense(
        `Potential duplicate ID \`${identifier}\` found within the same control flow branch. If this expression evaluates to the same value, IDs must be unique.`,
        location,
        undefined,
        "hint",
      )

      return
    }

    this.addOffense(
      `Duplicate ID \`${identifier}\` found within the same control flow branch. IDs must be unique within the same control flow branch.`,
      location,
    )
  }

  private addPotentialDuplicateIdOffense(identifier: string, location: any): void {
    this.addOffense(
      `Potential duplicate ID \`${identifier}\` found. If this expression evaluates to the same value, IDs must be unique within a document.`,
      location,
      undefined,
      "hint",
    )
  }
}

export class HTMLNoDuplicateIdsRule extends ParserRule {
  static ruleName = "html-no-duplicate-ids"
  static introducedIn = this.version("0.4.1")
  static defaultEnabledIn = this.version("0.4.1")

  get defaultConfig(): FullRuleConfig {
    return {
      enabled: true,
      severity: "error",
      environments: ["cli", "browser"],
    }
  }

  get parserOptions(): Partial<ParserOptions> {
    return {
      action_view_helpers: true,
      iteration_nodes: true,
      prism_program: true
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const loopDerivedNames = new LoopDerivedNamesVisitor()
    // An ERB tag's prismNode only includes its first statement.
    const program = result.value.prismNode

    if (program) loopDerivedNames.visit(program)

    const visitor = new NoDuplicateIdsVisitor(this.ruleName, context, loopDerivedNames)

    visitor.visit(result.value)

    return visitor.offenses
  }
}
