import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Connection, TextDocuments } from 'vscode-languageserver'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { DocumentService } from '../src/document_service'

vi.mock('vscode-languageserver/node', () => ({
  TextDocuments: vi.fn().mockImplementation(() => ({
    listen: vi.fn(),
    get: vi.fn(),
    all: vi.fn(),
    onDidChangeContent: vi.fn(),
    onDidOpen: vi.fn(),
    onDidClose: vi.fn()
  }))
}))

vi.mock('vscode-languageserver-textdocument', () => ({
  TextDocument: {
    create: vi.fn()
  }
}))

describe('DocumentService', () => {
  let mockConnection: Connection
  let documentService: DocumentService

  beforeEach(() => {
    mockConnection = {
      console: { log: vi.fn() }
    } as any

    documentService = new DocumentService(mockConnection)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should create TextDocuments with TextDocument type', () => {
    expect(documentService.documents).toBeDefined()
  })

  it('should setup document listener on connection', () => {
    expect(documentService.documents.listen).toHaveBeenCalledWith(mockConnection)
  })

  it('should get document by URI', () => {
    const mockDocument = { uri: 'test://document.html.erb' }
    vi.mocked(documentService.documents.get).mockReturnValue(mockDocument)

    const result = documentService.get('test://document.html.erb')

    expect(documentService.documents.get).toHaveBeenCalledWith('test://document.html.erb')
    expect(result).toBe(mockDocument)
  })

  it('should get all documents', () => {
    const mockDocuments = [
      { uri: 'test://doc1.html.erb' },
      { uri: 'test://doc2.html.erb' }
    ]
    vi.mocked(documentService.documents.all).mockReturnValue(mockDocuments)

    const result = documentService.getAll()

    expect(documentService.documents.all).toHaveBeenCalled()
    expect(result).toBe(mockDocuments)
  })

  it('should expose onDidChangeContent event handler', () => {
    const result = documentService.onDidChangeContent

    expect(result).toBe(documentService.documents.onDidChangeContent)
  })

  it('should expose onDidOpen event handler', () => {
    const result = documentService.onDidOpen

    expect(result).toBe(documentService.documents.onDidOpen)
  })

  it('should expose onDidClose event handler', () => {
    const result = documentService.onDidClose

    expect(result).toBe(documentService.documents.onDidClose)
  })

  it('should return undefined when getting non-existent document', () => {
    vi.mocked(documentService.documents.get).mockReturnValue(undefined)

    const result = documentService.get('test://nonexistent.html.erb')

    expect(result).toBeUndefined()
  })

  it('should return empty array when no documents exist', () => {
    vi.mocked(documentService.documents.all).mockReturnValue([])

    const result = documentService.getAll()

    expect(result).toEqual([])
  })

  it('should have documents property accessible', () => {
    expect(documentService.documents).toBeDefined()
  })
})
