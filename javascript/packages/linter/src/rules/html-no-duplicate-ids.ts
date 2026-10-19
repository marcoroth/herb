import { ParserRule, BaseAutofixContext } from "../types"
import { ControlFlowTrackingVisitor, ControlFlowType } from "../utils/rule-utils.js"
import { Printer, IdentityPrinter } from "@herb-tools/printer"

import { Visitor, PrismVisitor, hasDynamicOutput, getValidatableStaticContent, getStaticAttributeName, isERBOutputNode, isRubyLiteralNode, isHTMLElementNode, isKnownHTMLElement, getTagName, getTagLocalName, isPrismNodeType, isRubyParameterNode, offsetFromPosition, stringIndexFromByteOffset } from "@herb-tools/core"

import type * as Nodes from "@herb-tools/core"
import type { ParseResult, DocumentNode, HTMLAttributeNode, HTMLElementNode, LiteralNode, ERBContentNode, RubyLiteralNode, ParserOptions, PrismNode, PrismNodes } from "@herb-tools/core"
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

const IMPLICIT_BLOCK_PARAMETERS = ["it", "_1", "_2", "_3", "_4", "_5", "_6", "_7", "_8", "_9"]

class IterationBlockCollector extends Visitor {
  readonly parametersByOpening = new Map<number, string[]>()

  constructor(private readonly source: string) {
    super()
  }

  visitERBIterationBlockNode(node: Nodes.ERBIterationBlockNode): void {
    const opening = node.block_opening?.location?.start
    const offset = opening ? offsetFromPosition(this.source, opening) : null

    if (offset !== null) this.parametersByOpening.set(offset, this.parameterNames(node))

    super.visitERBIterationBlockNode(node)
  }

  private parameterNames(node: Nodes.ERBIterationBlockNode): string[] {
    const declared = node.block_arguments
      .filter(isRubyParameterNode)
      .map(argument => argument.name?.value)
      .filter((name): name is string => Boolean(name))

    return declared.length > 0 ? declared : IMPLICIT_BLOCK_PARAMETERS
  }
}

class LoopVaryingReadCollector extends PrismVisitor {
  readonly readOffsets: number[] = []

  private readonly scopes: Set<string>[] = []

  constructor(private readonly source: string, private readonly parametersByOpening: Map<number, string[]>) {
    super()
  }

  override visit(node: PrismNode): void {
    if (!node) return

    super.visit(node)
  }

  visitBlockNode(node: PrismNodes.BlockNode): void {
    const parameters = this.parametersByOpening.get(stringIndexFromByteOffset(this.source, node.openingLoc.startOffset))

    if (!parameters) {
      this.visitChildNodes(node)

      return
    }

    this.scopes.push(new Set(parameters))
    this.visit(node.body)
    this.scopes.pop()
  }

  visitLocalVariableReadNode(node: PrismNodes.LocalVariableReadNode): void {
    this.read(node.name, node.location.startOffset)
  }

  visitItLocalVariableReadNode(node: PrismNodes.ItLocalVariableReadNode): void {
    this.read("it", node.location.startOffset)
  }

  visitLocalVariableWriteNode(node: PrismNodes.LocalVariableWriteNode): void {
    this.assign([node.name], node.value, true)
  }

  visitLocalVariableOperatorWriteNode(node: PrismNodes.LocalVariableOperatorWriteNode): void {
    this.assign([node.name], node.value, false)
  }

  visitLocalVariableOrWriteNode(node: PrismNodes.LocalVariableOrWriteNode): void {
    this.assign([node.name], node.value, false)
  }

  visitLocalVariableAndWriteNode(node: PrismNodes.LocalVariableAndWriteNode): void {
    this.assign([node.name], node.value, false)
  }

  visitMultiWriteNode(node: PrismNodes.MultiWriteNode): void {
    const targets = [...node.lefts, node.rest, ...node.rights]

    this.assign(targets.flatMap(target => this.targetNames(target)), node.value, true)
  }

  private get currentScope(): Set<string> | undefined {
    return this.scopes[this.scopes.length - 1]
  }

  private read(name: string, offset: number): void {
    if (this.currentScope?.has(name)) this.readOffsets.push(stringIndexFromByteOffset(this.source, offset))
  }

  private assign(names: string[], value: PrismNode, replaces: boolean): void {
    const readsBefore = this.readOffsets.length

    this.visit(value)

    const scope = this.currentScope
    if (!scope) return

    const varies = this.readOffsets.length > readsBefore

    for (const name of names) {
      if (varies) {
        scope.add(name)
      } else if (replaces) {
        scope.delete(name)
      }
    }
  }

  private targetNames(node: PrismNode | null): string[] {
    if (!node) return []
    if (isPrismNodeType(node, "LocalVariableTargetNode")) return [node.name]

    return node.childNodes().flatMap((child: PrismNode | null) => this.targetNames(child))
  }
}

class NoDuplicateIdsVisitor extends ControlFlowTrackingVisitor<BaseAutofixContext, ControlFlowState, BranchState> {
  private documentIds: Set<string> = new Set<string>()
  private currentBranchIds: Set<string> = new Set<string>()
  private controlFlowIds: Set<string> = new Set<string>()
  private iterationDepth = 0
  private source: string | null = null
  private loopVaryingReads: number[] | null = null

  collectLoopVaryingReads(document: DocumentNode): void {
    const source = document.source
    const program = document.prismNode

    if (!source || !program) return

    this.source = source

    const iterationBlocks = new IterationBlockCollector(source)
    iterationBlocks.visit(document)

    const reads = new LoopVaryingReadCollector(source, iterationBlocks.parametersByOpening)
    reads.visit(program)

    this.loopVaryingReads = reads.readOffsets
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
    this.iterationDepth++
    super.visitERBIterationBlockNode(node)
    this.iterationDepth--
  }

  private variesPerIteration(attributeNode: HTMLAttributeNode): boolean {
    const source = this.source
    const reads = this.loopVaryingReads

    if (!source || !reads) return true

    return (attributeNode.value?.children ?? []).some(child => {
      if (!isERBOutputNode(child) && !isRubyLiteralNode(child)) return false
      if (!child.location) return false

      const start = offsetFromPosition(source, child.location.start)
      const end = offsetFromPosition(source, child.location.end)

      if (start === null || end === null) return false

      return reads.some(offset => offset >= start && offset < end)
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

    if (this.iterationDepth > 0 && !this.variesPerIteration(attributeNode)) {
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
      prism_program: true,
    }
  }

  check(result: ParseResult, context?: Partial<LintContext>): UnboundLintOffense[] {
    const visitor = new NoDuplicateIdsVisitor(this.ruleName, context)

    visitor.collectLoopVaryingReads(result.value)
    visitor.visit(result.value)

    return visitor.offenses
  }
}
