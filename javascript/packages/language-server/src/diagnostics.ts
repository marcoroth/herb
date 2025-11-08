import { TextDocument } from "vscode-languageserver-textdocument"
import { Connection, Diagnostic, DiagnosticSeverity, DiagnosticTag } from "vscode-languageserver/node"
import { Visitor } from "@herb-tools/core"

import type {
  Node,
  ERBCaseNode,
  ERBCaseMatchNode,
  ERBIfNode,
  ERBElseNode,
  ERBUnlessNode,
  ERBForNode,
  ERBWhileNode,
  ERBUntilNode,
  ERBWhenNode,
  ERBBeginNode,
  ERBRescueNode,
  ERBEnsureNode,
  ERBBlockNode,
  ERBInNode,
} from "@herb-tools/core"

import { isHTMLTextNode } from "@herb-tools/core"

import { ParserService } from "./parser_service"
import { LinterService } from "./linter_service"
import { DocumentService } from "./document_service"
import { ConfigService } from "./config_service"

export class Diagnostics {
  private readonly connection: Connection
  private readonly documentService: DocumentService
  private readonly parserService: ParserService
  private readonly linterService: LinterService
  private readonly configService: ConfigService
  private diagnostics: Map<TextDocument, Diagnostic[]> = new Map()

  constructor(
    connection: Connection,
    documentService: DocumentService,
    parserService: ParserService,
    linterService: LinterService,
    configService: ConfigService,
  ) {
    this.connection = connection
    this.documentService = documentService
    this.parserService = parserService
    this.linterService = linterService
    this.configService = configService
  }

  async validate(textDocument: TextDocument) {
    let allDiagnostics: Diagnostic[] = []

    if (textDocument.uri.endsWith('.herb.yml')) {
      allDiagnostics = await this.configService.validateDocument(textDocument)
    } else {
      const parseResult = this.parserService.parseDocument(textDocument)
      const lintResult = await this.linterService.lintDocument(textDocument)
      const unreachableCodeDiagnostics = this.getUnreachableCodeDiagnostics(parseResult.document)

      allDiagnostics = [
        ...parseResult.diagnostics,
        ...lintResult.diagnostics,
        ...unreachableCodeDiagnostics,
      ]
    }

    this.diagnostics.set(textDocument, allDiagnostics)
    this.sendDiagnosticsFor(textDocument)
  }

  private getUnreachableCodeDiagnostics(document: Node): Diagnostic[] {
    const collector = new UnreachableCodeCollector()
    collector.visit(document)
    return collector.diagnostics
  }

  async refreshDocument(document: TextDocument) {
    await this.validate(document)
  }

  async refreshAllDocuments() {
    const documents = this.documentService.getAll()
    await Promise.all(documents.map(document => this.refreshDocument(document)))
  }

  private sendDiagnosticsFor(textDocument: TextDocument) {
    const diagnostics = this.diagnostics.get(textDocument) || []

    this.connection.sendDiagnostics({
      uri: textDocument.uri,
      diagnostics,
    })

    this.diagnostics.delete(textDocument)
  }
}

export class UnreachableCodeCollector extends Visitor {
  diagnostics: Diagnostic[] = []
  private processedIfNodes: Set<ERBIfNode> = new Set()
  private processedElseNodes: Set<ERBElseNode> = new Set()

  visitERBCaseNode(node: ERBCaseNode): void {
    this.checkUnreachableChildren(node.children)
    this.checkAndMarkElseClause(node.else_clause)
    this.visitChildNodes(node)
  }

  visitERBCaseMatchNode(node: ERBCaseMatchNode): void {
    this.checkUnreachableChildren(node.children)
    this.checkAndMarkElseClause(node.else_clause)
    this.visitChildNodes(node)
  }

  visitERBIfNode(node: ERBIfNode): void {
    if (this.processedIfNodes.has(node)) {
      return
    }

    this.markIfChainAsProcessed(node)

    this.markElseNodesInIfChain(node)

    const entireChainEmpty = this.isEntireIfChainEmpty(node)

    if (entireChainEmpty) {
      this.checkEmptyStatements(node, node.statements, "if")
    } else {
      this.checkIfChainParts(node)
    }

    this.visitChildNodes(node)
  }

  visitERBElseNode(node: ERBElseNode): void {
    if (this.processedElseNodes.has(node)) {
      this.visitChildNodes(node)
      return
    }

    this.checkEmptyStatements(node, node.statements, "else")
    this.visitChildNodes(node)
  }

  visitERBUnlessNode(node: ERBUnlessNode): void {
    const unlessHasContent = this.statementsHaveContent(node.statements)
    const elseHasContent = node.else_clause && this.statementsHaveContent(node.else_clause.statements)

    if (node.else_clause) {
      this.processedElseNodes.add(node.else_clause)
    }

    const entireBlockEmpty = !unlessHasContent && !elseHasContent

    if (entireBlockEmpty) {
      this.checkEmptyStatements(node, node.statements, "unless")
    } else {
      if (!unlessHasContent) {
        this.checkEmptyStatementsWithEndLocation(node, node.statements, "unless", node.else_clause)
      }

      if (node.else_clause && !elseHasContent) {
        this.checkEmptyStatements(node.else_clause, node.else_clause.statements, "else")
      }
    }

    this.visitChildNodes(node)
  }

  visitERBForNode(node: ERBForNode): void {
    this.checkEmptyStatements(node, node.statements, "for")
    this.visitChildNodes(node)
  }

  visitERBWhileNode(node: ERBWhileNode): void {
    this.checkEmptyStatements(node, node.statements, "while")
    this.visitChildNodes(node)
  }

  visitERBUntilNode(node: ERBUntilNode): void {
    this.checkEmptyStatements(node, node.statements, "until")
    this.visitChildNodes(node)
  }

  visitERBWhenNode(node: ERBWhenNode): void {
    this.checkEmptyStatements(node, node.statements, "when")
    this.visitChildNodes(node)
  }

  visitERBBeginNode(node: ERBBeginNode): void {
    this.checkEmptyStatements(node, node.statements, "begin")
    this.visitChildNodes(node)
  }

  visitERBRescueNode(node: ERBRescueNode): void {
    this.checkEmptyStatements(node, node.statements, "rescue")
    this.visitChildNodes(node)
  }

  visitERBEnsureNode(node: ERBEnsureNode): void {
    this.checkEmptyStatements(node, node.statements, "ensure")
    this.visitChildNodes(node)
  }

  visitERBBlockNode(node: ERBBlockNode): void {
    this.checkEmptyStatements(node, node.body, "block")
    this.visitChildNodes(node)
  }

  visitERBInNode(node: ERBInNode): void {
    this.checkEmptyStatements(node, node.statements, "in")
    this.visitChildNodes(node)
  }

  private checkUnreachableChildren(children: Node[]): void {
    for (const child of children) {
      if (isHTMLTextNode(child) && child.content.trim() === "") {
        continue
      }

      this.addDiagnostic(
        child.location,
        "Unreachable code: content between case and when/in is never executed"
      )
    }
  }

  private checkEmptyStatements(node: Node, statements: Node[], blockType: string): void {
    this.checkEmptyStatementsWithEndLocation(node, statements, blockType, null)
  }

  private checkEmptyStatementsWithEndLocation(node: Node, statements: Node[], blockType: string, subsequentNode: Node | null): void {
    if (this.statementsHaveContent(statements)) {
      return
    }

    const startLocation = node.location.start
    const endLocation = subsequentNode
      ? subsequentNode.location.start
      : node.location.end

    this.addDiagnostic(
      { start: startLocation, end: endLocation },
      `Empty ${blockType} block: this control flow statement has no content`
    )
  }

  private addDiagnostic(location: { start: { line: number; column: number }, end: { line: number; column: number } }, message: string): void {
    const diagnostic: Diagnostic = {
      range: {
        start: {
          line: this.toZeroBased(location.start.line),
          character: location.start.column
        },
        end: {
          line: this.toZeroBased(location.end.line),
          character: location.end.column
        }
      },
      message,
      severity: DiagnosticSeverity.Hint,
      tags: [DiagnosticTag.Unnecessary],
      source: "Herb Language Server"
    }

    this.diagnostics.push(diagnostic)
  }

  private statementsHaveContent(statements: Node[]): boolean {
    return statements.some(statement => {
      if (isHTMLTextNode(statement)) {
        return statement.content.trim() !== ""
      }

      return true
    })
  }

  private checkAndMarkElseClause(elseClause: ERBElseNode | null): void {
    if (!elseClause) {
      return
    }

    this.processedElseNodes.add(elseClause)
    if (!this.statementsHaveContent(elseClause.statements)) {
      this.checkEmptyStatements(elseClause, elseClause.statements, "else")
    }
  }

  private markIfChainAsProcessed(node: ERBIfNode): void {
    this.processedIfNodes.add(node)
    this.traverseSubsequentNodes(node.subsequent, (current) => {
      if (current.type === 'AST_ERB_IF_NODE') {
        this.processedIfNodes.add(current as ERBIfNode)
      }
    })
  }

  private markElseNodesInIfChain(node: ERBIfNode): void {
    this.traverseSubsequentNodes(node.subsequent, (current) => {
      if (current.type === 'AST_ERB_ELSE_NODE') {
        this.processedElseNodes.add(current as ERBElseNode)
      }
    })
  }

  private traverseSubsequentNodes(startNode: Node | null, callback: (node: Node) => void): void {
    let current = startNode
    while (current) {
      callback(current)

      if ('subsequent' in current) {
        current = (current as any).subsequent
      } else {
        break
      }
    }
  }

  private checkIfChainParts(node: ERBIfNode): void {
    if (!this.statementsHaveContent(node.statements)) {
      this.checkEmptyStatementsWithEndLocation(node, node.statements, "if", node.subsequent)
    }

    this.traverseSubsequentNodes(node.subsequent, (current) => {
      if (!('statements' in current) || !Array.isArray((current as any).statements)) {
        return
      }

      if (this.statementsHaveContent((current as any).statements)) {
        return
      }

      const blockType = current.type === 'AST_ERB_IF_NODE' ? 'elsif' : 'else'
      const nextSubsequent = 'subsequent' in current ? (current as any).subsequent : null

      if (nextSubsequent) {
        this.checkEmptyStatementsWithEndLocation(current, (current as any).statements, blockType, nextSubsequent)
      } else {
        this.checkEmptyStatements(current, (current as any).statements, blockType)
      }
    })
  }

  private isEntireIfChainEmpty(node: ERBIfNode): boolean {
    if (this.statementsHaveContent(node.statements)) {
      return false
    }

    let hasContent = false
    this.traverseSubsequentNodes(node.subsequent, (current) => {
      if ('statements' in current && Array.isArray((current as any).statements)) {
        if (this.statementsHaveContent((current as any).statements)) {
          hasContent = true
        }
      }
    })

    return !hasContent
  }

  private toZeroBased(line: number): number {
    return line - 1
  }
}
