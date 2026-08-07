import { PrismVisitor, PrismNodes } from "@herb-tools/core"

import type { PrismLocation } from "@herb-tools/core"

export interface RubyReference {
  name: string
  startOffset: number
  length: number
}

export class RubyReferenceCollector extends PrismVisitor {
  readonly localReads: RubyReference[] = []
  readonly localBindings: RubyReference[] = []
  readonly instanceVariableReads: RubyReference[] = []
  readonly instanceVariableWrites: RubyReference[] = []
  readonly bareCalls: RubyReference[] = []

  override visitLocalVariableReadNode(node: PrismNodes.LocalVariableReadNode): void {
    this.push(this.localReads, node.name, node.location)

    this.visitChildNodes(node)
  }

  override visitLocalVariableWriteNode(node: PrismNodes.LocalVariableWriteNode): void {
    this.push(this.localBindings, node.name, node.nameLoc)

    this.visitChildNodes(node)
  }

  override visitLocalVariableAndWriteNode(node: PrismNodes.LocalVariableAndWriteNode): void {
    this.push(this.localBindings, node.name, node.nameLoc)

    this.visitChildNodes(node)
  }

  override visitLocalVariableOrWriteNode(node: PrismNodes.LocalVariableOrWriteNode): void {
    this.push(this.localBindings, node.name, node.nameLoc)

    this.visitChildNodes(node)
  }

  override visitLocalVariableOperatorWriteNode(node: PrismNodes.LocalVariableOperatorWriteNode): void {
    this.push(this.localBindings, node.name, node.nameLoc)

    this.visitChildNodes(node)
  }

  override visitLocalVariableTargetNode(node: PrismNodes.LocalVariableTargetNode): void {
    this.push(this.localBindings, node.name, node.location)

    this.visitChildNodes(node)
  }

  override visitRequiredParameterNode(node: PrismNodes.RequiredParameterNode): void {
    this.push(this.localBindings, node.name, node.location)

    this.visitChildNodes(node)
  }

  override visitOptionalParameterNode(node: PrismNodes.OptionalParameterNode): void {
    this.push(this.localBindings, node.name, node.nameLoc)

    this.visitChildNodes(node)
  }

  override visitRequiredKeywordParameterNode(node: PrismNodes.RequiredKeywordParameterNode): void {
    this.push(this.localBindings, node.name, node.nameLoc)

    this.visitChildNodes(node)
  }

  override visitOptionalKeywordParameterNode(node: PrismNodes.OptionalKeywordParameterNode): void {
    this.push(this.localBindings, node.name, node.nameLoc)

    this.visitChildNodes(node)
  }

  override visitRestParameterNode(node: PrismNodes.RestParameterNode): void {
    this.push(this.localBindings, node.name, node.nameLoc)

    this.visitChildNodes(node)
  }

  override visitKeywordRestParameterNode(node: PrismNodes.KeywordRestParameterNode): void {
    this.push(this.localBindings, node.name, node.nameLoc)

    this.visitChildNodes(node)
  }

  override visitBlockParameterNode(node: PrismNodes.BlockParameterNode): void {
    this.push(this.localBindings, node.name, node.nameLoc)

    this.visitChildNodes(node)
  }

  override visitBlockLocalVariableNode(node: PrismNodes.BlockLocalVariableNode): void {
    this.push(this.localBindings, node.name, node.location)

    this.visitChildNodes(node)
  }

  override visitInstanceVariableReadNode(node: PrismNodes.InstanceVariableReadNode): void {
    this.push(this.instanceVariableReads, node.name, node.location)

    this.visitChildNodes(node)
  }

  override visitInstanceVariableWriteNode(node: PrismNodes.InstanceVariableWriteNode): void {
    this.push(this.instanceVariableWrites, node.name, node.nameLoc)

    this.visitChildNodes(node)
  }

  override visitInstanceVariableAndWriteNode(node: PrismNodes.InstanceVariableAndWriteNode): void {
    this.push(this.instanceVariableWrites, node.name, node.nameLoc)

    this.visitChildNodes(node)
  }

  override visitInstanceVariableOrWriteNode(node: PrismNodes.InstanceVariableOrWriteNode): void {
    this.push(this.instanceVariableWrites, node.name, node.nameLoc)

    this.visitChildNodes(node)
  }

  override visitInstanceVariableOperatorWriteNode(node: PrismNodes.InstanceVariableOperatorWriteNode): void {
    this.push(this.instanceVariableWrites, node.name, node.nameLoc)

    this.visitChildNodes(node)
  }

  override visitInstanceVariableTargetNode(node: PrismNodes.InstanceVariableTargetNode): void {
    this.push(this.instanceVariableWrites, node.name, node.location)

    this.visitChildNodes(node)
  }

  override visitCallNode(node: PrismNodes.CallNode): void {
    if (node.receiver === null && node.arguments_ === null && node.block === null) {
      this.push(this.bareCalls, node.name, node.messageLoc ?? node.location)
    }

    this.visitChildNodes(node)
  }

  private push(references: RubyReference[], name: string | null, location: PrismLocation | null): void {
    if (!name || !location) return

    references.push({ name, startOffset: location.startOffset, length: location.length })
  }
}
