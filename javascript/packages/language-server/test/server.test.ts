import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  Connection,
  InitializeParams,
  TextDocumentSyncKind,
  InitializeResult
} from 'vscode-languageserver'
import { Server } from '../src/server'
import { Service } from '../src/service'

vi.mock('vscode-languageserver/node', () => ({
  createConnection: vi.fn(),
  ProposedFeatures: { all: {} },
  DidChangeConfigurationNotification: { type: 'workspace/didChangeConfiguration' },
  DidChangeWatchedFilesNotification: { type: 'workspace/didChangeWatchedFiles' },
  TextDocumentSyncKind: { Incremental: 2 }
}))

vi.mock('../src/service')

describe('Server', () => {
  let mockConnection: any
  let server: Server

  beforeEach(async () => {
    mockConnection = {
      onInitialize: vi.fn(),
      onInitialized: vi.fn(),
      onDidChangeConfiguration: vi.fn(),
      onDidOpenTextDocument: vi.fn(),
      onDidChangeWatchedFiles: vi.fn(),
      listen: vi.fn(),
      console: { log: vi.fn() },
      client: {
        register: vi.fn()
      },
      workspace: {
        onDidChangeWorkspaceFolders: vi.fn()
      }
    }

    const { createConnection } = await import('vscode-languageserver/node')
    vi.mocked(createConnection).mockReturnValue(mockConnection)

    server = new Server()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should create connection with ProposedFeatures.all', async () => {
    const { createConnection, ProposedFeatures } = await import('vscode-languageserver/node')

    expect(createConnection).toHaveBeenCalledWith(ProposedFeatures.all)
  })

  it('should setup event handlers on construction', () => {
    expect(mockConnection.onInitialize).toHaveBeenCalled()
    expect(mockConnection.onInitialized).toHaveBeenCalled()
    expect(mockConnection.onDidChangeConfiguration).toHaveBeenCalled()
    expect(mockConnection.onDidOpenTextDocument).toHaveBeenCalled()
    expect(mockConnection.onDidChangeWatchedFiles).toHaveBeenCalled()
  })

  it('should initialize service and return capabilities on initialize', async () => {
    const mockService = {
      init: vi.fn(),
      settings: {
        hasWorkspaceFolderCapability: false
      }
    }
    vi.mocked(Service).mockImplementation(() => mockService as any)

    const initParams: InitializeParams = {
      processId: 1234,
      rootUri: 'file:///test',
      capabilities: {}
    }

    const initializeHandler = mockConnection.onInitialize.mock.calls[0][0]
    const result: InitializeResult = await initializeHandler(initParams)

    expect(Service).toHaveBeenCalledWith(mockConnection, initParams)
    expect(mockService.init).toHaveBeenCalled()
    expect(result.capabilities.textDocumentSync).toBe(TextDocumentSyncKind.Incremental)
  })

  it('should include workspace capabilities when supported', async () => {
    const mockService = {
      init: vi.fn(),
      settings: {
        hasWorkspaceFolderCapability: true
      }
    }
    vi.mocked(Service).mockImplementation(() => mockService as any)

    const initParams: InitializeParams = {
      processId: 1234,
      rootUri: 'file:///test',
      capabilities: {}
    }

    const initializeHandler = mockConnection.onInitialize.mock.calls[0][0]
    const result: InitializeResult = await initializeHandler(initParams)

    expect(result.capabilities.workspace?.workspaceFolders?.supported).toBe(true)
  })

  it('should register for configuration changes when capability is available', async () => {
    const mockService = {
      init: vi.fn(),
      settings: {
        hasConfigurationCapability: true,
        hasWorkspaceFolderCapability: false
      }
    }
    vi.mocked(Service).mockImplementation(() => mockService as any)

    // Initialize service first
    const initParams: InitializeParams = {
      processId: 1234,
      rootUri: 'file:///test',
      capabilities: {}
    }
    const initializeHandler = mockConnection.onInitialize.mock.calls[0][0]
    await initializeHandler(initParams)

    // Trigger onInitialized
    const onInitializedHandler = mockConnection.onInitialized.mock.calls[0][0]
    onInitializedHandler()

    expect(mockConnection.client.register).toHaveBeenCalledWith(
      'workspace/didChangeConfiguration',
      undefined
    )
  })

  it('should register file watchers on initialization', async () => {
    const mockService = {
      init: vi.fn(),
      settings: {
        hasConfigurationCapability: false,
        hasWorkspaceFolderCapability: false
      }
    }
    vi.mocked(Service).mockImplementation(() => mockService as any)

    // Initialize service first
    const initParams: InitializeParams = {
      processId: 1234,
      rootUri: 'file:///test',
      capabilities: {}
    }
    const initializeHandler = mockConnection.onInitialize.mock.calls[0][0]
    await initializeHandler(initParams)

    const onInitializedHandler = mockConnection.onInitialized.mock.calls[0][0]
    onInitializedHandler()

    expect(mockConnection.client.register).toHaveBeenCalledWith(
      'workspace/didChangeWatchedFiles',
      {
        watchers: [
          { globPattern: '**/**/*.html.erb' },
          { globPattern: '**/**/.herb-lsp/config.json' }
        ]
      }
    )
  })

  it('should call listen method', () => {
    server.listen()
    expect(mockConnection.listen).toHaveBeenCalled()
  })

  it('should handle document open events', async () => {
    const mockService = {
      init: vi.fn(),
      settings: { hasWorkspaceFolderCapability: false },
      documentService: {
        get: vi.fn().mockReturnValue({ uri: 'test://document' })
      },
      diagnostics: {
        refreshDocument: vi.fn()
      }
    }
    vi.mocked(Service).mockImplementation(() => mockService as any)

    // Initialize to set up service
    const initParams: InitializeParams = {
      processId: 1234,
      rootUri: 'file:///test',
      capabilities: {}
    }
    const initializeHandler = mockConnection.onInitialize.mock.calls[0][0]
    await initializeHandler(initParams)

    const onDidOpenHandler = mockConnection.onDidOpenTextDocument.mock.calls[0][0]
    const openParams = {
      textDocument: { uri: 'test://document' }
    }

    onDidOpenHandler(openParams)

    expect(mockService.documentService.get).toHaveBeenCalledWith('test://document')
    expect(mockService.diagnostics.refreshDocument).toHaveBeenCalledWith({ uri: 'test://document' })
  })
})
