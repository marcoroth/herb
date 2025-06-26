import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Connection, InitializeParams } from 'vscode-languageserver'
import { Service } from '../src/service'
import { Settings } from '../src/settings'
import { DocumentService } from '../src/document_service'
import { Diagnostics } from '../src/diagnostics'
import { Config } from '../src/config'
import { Project } from '../src/project'

vi.mock('../src/settings')
vi.mock('../src/document_service')
vi.mock('../src/diagnostics')
vi.mock('../src/config')
vi.mock('../src/project')

describe('Service', () => {
  let mockConnection: Connection
  let mockParams: InitializeParams
  let service: Service

  beforeEach(() => {
    mockConnection = {
      console: { log: vi.fn() }
    } as any

    mockParams = {
      processId: 1234,
      rootUri: 'file:///test/project',
      capabilities: {}
    }

    const mockSettings = {
      projectPath: 'file:///test/project',
      documentSettings: new Map()
    }
    const mockDocumentService = {
      onDidClose: vi.fn(),
      onDidChangeContent: vi.fn()
    }
    const mockProject = {
      initialize: vi.fn(),
      refresh: vi.fn(),
      projectPath: '/test/project'
    }
    const mockDiagnostics = {
      refreshDocument: vi.fn(),
      refreshAllDocuments: vi.fn()
    }
    const mockConfig = {
      fromPathOrNew: vi.fn().mockResolvedValue({ test: 'config' })
    }

    vi.mocked(Settings).mockImplementation(() => mockSettings as any)
    vi.mocked(DocumentService).mockImplementation(() => mockDocumentService as any)
    vi.mocked(Project).mockImplementation(() => mockProject as any)
    vi.mocked(Diagnostics).mockImplementation(() => mockDiagnostics as any)
    vi.mocked(Config).mockImplementation(() => mockConfig as any)
    vi.mocked(Config.fromPathOrNew).mockResolvedValue({ test: 'config' } as any)

    service = new Service(mockConnection, mockParams)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should initialize all services with correct parameters', () => {
    expect(Settings).toHaveBeenCalledWith(mockParams, mockConnection)
    expect(DocumentService).toHaveBeenCalledWith(mockConnection)
    expect(Project).toHaveBeenCalledWith(mockConnection, '/test/project')
    expect(Diagnostics).toHaveBeenCalledWith(mockConnection, expect.any(Object))
  })

  it('should initialize project and config on init', async () => {
    await service.init()

    expect(service.project.initialize).toHaveBeenCalled()
    expect(Config.fromPathOrNew).toHaveBeenCalledWith('/test/project')
    expect(service.config).toEqual({ test: 'config' })
  })

  it('should setup document service event handlers on init', async () => {
    await service.init()

    expect(service.documentService.onDidClose).toHaveBeenCalled()
    expect(service.documentService.onDidChangeContent).toHaveBeenCalled()
  })

  it('should handle document close events by clearing settings', async () => {
    const mockSettings = new Map()
    mockSettings.set('test://document', { someSettings: true })
    service.settings.documentSettings = mockSettings

    await service.init()

    const onDidCloseHandler = vi.mocked(service.documentService.onDidClose).mock.calls[0][0]
    onDidCloseHandler({
      document: { uri: 'test://document' }
    })

    expect(service.settings.documentSettings.has('test://document')).toBe(false)
  })

  it('should handle document change events by refreshing diagnostics', async () => {
    await service.init()

    const onDidChangeContentHandler = vi.mocked(service.documentService.onDidChangeContent).mock.calls[0][0]
    const mockDocument = { uri: 'test://document' }
    onDidChangeContentHandler({
      document: mockDocument
    })

    expect(service.diagnostics.refreshDocument).toHaveBeenCalledWith(mockDocument)
  })

  it('should refresh project and diagnostics on refresh', async () => {
    await service.init()
    await service.refresh()

    expect(service.project.refresh).toHaveBeenCalled()
    expect(service.diagnostics.refreshAllDocuments).toHaveBeenCalled()
  })

  it('should refresh config on refreshConfig', async () => {
    await service.init()
    await service.refreshConfig()

    expect(Config.fromPathOrNew).toHaveBeenCalledWith('/test/project')
    expect(service.config).toEqual({ test: 'config' })
  })

  it('should have all required service instances', () => {
    expect(service.connection).toBe(mockConnection)
    expect(service.settings).toBeInstanceOf(Object)
    expect(service.diagnostics).toBeInstanceOf(Object)
    expect(service.documentService).toBeInstanceOf(Object)
    expect(service.project).toBeInstanceOf(Object)
  })
})
