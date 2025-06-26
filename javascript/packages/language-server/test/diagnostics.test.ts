import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Connection, DiagnosticSeverity, Range, Position } from 'vscode-languageserver'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { Diagnostics } from '../src/diagnostics'
import { DocumentService } from '../src/document_service'
import { Herb, Visitor } from '@herb-tools/node-wasm'

vi.mock('@herb-tools/node-wasm', () => ({
  Herb: {
    parse: vi.fn()
  },
  Visitor: class MockVisitor {
    visitChildNodes(node: any) {
      // Mock implementation
    }
  }
}))

describe('Diagnostics', () => {
  let mockConnection: Connection
  let mockDocumentService: DocumentService
  let diagnostics: Diagnostics
  let mockDocument: TextDocument

  beforeEach(() => {
    mockConnection = {
      sendDiagnostics: vi.fn(),
      console: { log: vi.fn() }
    } as any

    mockDocumentService = {
      getAll: vi.fn().mockReturnValue([])
    } as any

    mockDocument = {
      uri: 'test://document.html.erb',
      getText: vi.fn().mockReturnValue('<%= "hello" %>')
    } as any

    diagnostics = new Diagnostics(mockConnection, mockDocumentService)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should validate document and send diagnostics', () => {
    const mockParseResult = {
      visit: vi.fn()
    }
    vi.mocked(Herb.parse).mockReturnValue(mockParseResult)

    diagnostics.validate(mockDocument)

    expect(Herb.parse).toHaveBeenCalledWith('<%= "hello" %>')
    expect(mockParseResult.visit).toHaveBeenCalled()
    expect(mockConnection.sendDiagnostics).toHaveBeenCalledWith({
      uri: 'test://document.html.erb',
      diagnostics: []
    })
  })

  it('should push diagnostic with correct properties', () => {
    const range = Range.create(Position.create(0, 0), Position.create(0, 5))
    const diagnostic = diagnostics.pushDiagnostic(
      'Test error message',
      'test-error',
      range,
      mockDocument,
      { test: 'data' },
      DiagnosticSeverity.Error
    )

    expect(diagnostic).toEqual({
      source: 'Herb LSP ',
      severity: DiagnosticSeverity.Error,
      range,
      message: 'Test error message',
      code: 'test-error',
      data: { test: 'data' }
    })
  })

  it('should use default severity when not provided', () => {
    const range = Range.create(Position.create(0, 0), Position.create(0, 5))
    const diagnostic = diagnostics.pushDiagnostic(
      'Test message',
      'test-code',
      range,
      mockDocument
    )

    expect(diagnostic.severity).toBe(DiagnosticSeverity.Error)
  })

  it('should refresh document by calling validate', () => {
    const validateSpy = vi.spyOn(diagnostics, 'validate')

    diagnostics.refreshDocument(mockDocument)

    expect(validateSpy).toHaveBeenCalledWith(mockDocument)
  })

  it('should refresh all documents from document service', () => {
    const mockDocuments = [mockDocument, { ...mockDocument, uri: 'test://other.html.erb' }]
    vi.mocked(mockDocumentService.getAll).mockReturnValue(mockDocuments)
    const refreshDocumentSpy = vi.spyOn(diagnostics, 'refreshDocument')

    diagnostics.refreshAllDocuments()

    expect(mockDocumentService.getAll).toHaveBeenCalled()
    expect(refreshDocumentSpy).toHaveBeenCalledTimes(2)
    expect(refreshDocumentSpy).toHaveBeenCalledWith(mockDocuments[0])
    expect(refreshDocumentSpy).toHaveBeenCalledWith(mockDocuments[1])
  })

  it('should send accumulated diagnostics and clear them', () => {
    const range1 = Range.create(Position.create(0, 0), Position.create(0, 5))
    const range2 = Range.create(Position.create(1, 0), Position.create(1, 10))

    diagnostics.pushDiagnostic('Error 1', 'error-1', range1, mockDocument)
    diagnostics.pushDiagnostic('Error 2', 'error-2', range2, mockDocument)

    const mockParseResult = { visit: vi.fn() }
    vi.mocked(Herb.parse).mockReturnValue(mockParseResult)

    diagnostics.validate(mockDocument)

    expect(mockConnection.sendDiagnostics).toHaveBeenCalledWith({
      uri: 'test://document.html.erb',
      diagnostics: expect.arrayContaining([
        expect.objectContaining({ message: 'Error 1', code: 'error-1' }),
        expect.objectContaining({ message: 'Error 2', code: 'error-2' })
      ])
    })
  })

  it('should handle parse errors through visitor', () => {
    const mockError = {
      message: 'Parse error',
      type: 'syntax-error',
      location: {
        start: { line: 1, column: 5 },
        end: { line: 1, column: 10 }
      },
      toJSON: vi.fn().mockReturnValue({ type: 'syntax-error' })
    }

    const mockNode = {
      errors: [mockError],
      toJSON: vi.fn().mockReturnValue({ type: 'element' })
    }

    const mockParseResult = {
      visit: vi.fn().mockImplementation((visitor) => {
        visitor.visitChildNodes(mockNode)
      })
    }

    vi.mocked(Herb.parse).mockReturnValue(mockParseResult)

    diagnostics.validate(mockDocument)

    expect(mockConnection.sendDiagnostics).toHaveBeenCalledWith({
      uri: 'test://document.html.erb',
      diagnostics: expect.arrayContaining([
        expect.objectContaining({
          message: 'Parse error',
          code: 'syntax-error',
          severity: DiagnosticSeverity.Error,
          range: {
            start: { line: 0, character: 5 },
            end: { line: 0, character: 10 }
          }
        })
      ])
    })
  })
})
