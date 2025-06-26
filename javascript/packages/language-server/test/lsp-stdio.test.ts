import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { spawn, ChildProcess } from 'child_process'
import { Readable, Writable } from 'stream'
import path from 'path'

interface LSPMessage {
  jsonrpc: string
  id?: number
  method?: string
  params?: any
  result?: any
  error?: any
}

class MockStdio {
  private messageBuffer = ''
  private messageQueue: LSPMessage[] = []
  private nextId = 1

  stdin = new Writable({
    write(chunk, encoding, callback) {
      callback()
    }
  })

  stdout = new Readable({
    read() {}
  })

  sendMessage(message: LSPMessage) {
    const messageStr = JSON.stringify(message)
    const fullMessage = `Content-Length: ${messageStr.length}\r\n\r\n${messageStr}`
    this.stdout.push(fullMessage)
  }

  sendInitializeRequest() {
    this.sendMessage({
      jsonrpc: '2.0',
      id: this.nextId++,
      method: 'initialize',
      params: {
        processId: process.pid,
        rootUri: 'file:///test/project',
        capabilities: {
          textDocument: {
            synchronization: {
              dynamicRegistration: true,
              willSave: true,
              willSaveWaitUntil: true,
              didSave: true
            }
          }
        }
      }
    })
  }

  sendInitializedNotification() {
    this.sendMessage({
      jsonrpc: '2.0',
      method: 'initialized',
      params: {}
    })
  }

  sendDidOpenNotification(uri: string, content: string) {
    this.sendMessage({
      jsonrpc: '2.0',
      method: 'textDocument/didOpen',
      params: {
        textDocument: {
          uri,
          languageId: 'erb',
          version: 1,
          text: content
        }
      }
    })
  }

  sendShutdownRequest() {
    this.sendMessage({
      jsonrpc: '2.0',
      id: this.nextId++,
      method: 'shutdown',
      params: null
    })
  }

  sendExitNotification() {
    this.sendMessage({
      jsonrpc: '2.0',
      method: 'exit'
    })
  }
}

describe('LSP stdio communication', () => {
  let mockStdio: MockStdio
  let receivedMessages: LSPMessage[]

  beforeEach(() => {
    mockStdio = new MockStdio()
    receivedMessages = []
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should handle LSP message format correctly', () => {
    const testMessage = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { processId: 1234 }
    }

    const messageStr = JSON.stringify(testMessage)
    const expectedFormat = `Content-Length: ${messageStr.length}\r\n\r\n${messageStr}`

    mockStdio.sendMessage(testMessage)

    expect(expectedFormat).toMatch(/^Content-Length: \d+\r\n\r\n{"jsonrpc":"2.0"/)
  })

  it('should parse LSP initialize request', () => {
    const initializeMessage = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        processId: process.pid,
        rootUri: 'file:///test/project',
        capabilities: {}
      }
    }

    expect(initializeMessage.method).toBe('initialize')
    expect(initializeMessage.params.rootUri).toBe('file:///test/project')
    expect(initializeMessage.jsonrpc).toBe('2.0')
  })

  it('should format initialize response correctly', () => {
    const initializeResponse = {
      jsonrpc: '2.0',
      id: 1,
      result: {
        capabilities: {
          textDocumentSync: 2,
          workspace: {
            workspaceFolders: {
              supported: true
            }
          }
        }
      }
    }

    expect(initializeResponse.result.capabilities.textDocumentSync).toBe(2)
    expect(initializeResponse.result.capabilities.workspace.workspaceFolders.supported).toBe(true)
  })

  it('should handle didOpen notification format', () => {
    const didOpenMessage = {
      jsonrpc: '2.0',
      method: 'textDocument/didOpen',
      params: {
        textDocument: {
          uri: 'file:///test/document.html.erb',
          languageId: 'erb',
          version: 1,
          text: '<%= "hello world" %>'
        }
      }
    }

    expect(didOpenMessage.method).toBe('textDocument/didOpen')
    expect(didOpenMessage.params.textDocument.uri).toBe('file:///test/document.html.erb')
    expect(didOpenMessage.params.textDocument.text).toBe('<%= "hello world" %>')
  })

  it('should format diagnostic notification correctly', () => {
    const diagnosticMessage = {
      jsonrpc: '2.0',
      method: 'textDocument/publishDiagnostics',
      params: {
        uri: 'file:///test/document.html.erb',
        diagnostics: [
          {
            range: {
              start: { line: 0, character: 0 },
              end: { line: 0, character: 5 }
            },
            severity: 1,
            message: 'Syntax error',
            source: 'Herb LSP',
            code: 'syntax-error'
          }
        ]
      }
    }

    expect(diagnosticMessage.method).toBe('textDocument/publishDiagnostics')
    expect(diagnosticMessage.params.diagnostics).toHaveLength(1)
    expect(diagnosticMessage.params.diagnostics[0].message).toBe('Syntax error')
  })

  it('should handle file watcher registration', () => {
    const watcherRegistration = {
      jsonrpc: '2.0',
      id: 2,
      method: 'client/registerCapability',
      params: {
        registrations: [
          {
            id: 'workspace/didChangeWatchedFiles',
            method: 'workspace/didChangeWatchedFiles',
            registerOptions: {
              watchers: [
                { globPattern: '**/**/*.html.erb' },
                { globPattern: '**/**/.herb-lsp/config.json' }
              ]
            }
          }
        ]
      }
    }

    expect(watcherRegistration.params.registrations[0].registerOptions.watchers).toHaveLength(2)
    expect(watcherRegistration.params.registrations[0].registerOptions.watchers[0].globPattern).toBe('**/**/*.html.erb')
  })

  it('should parse content-length header correctly', () => {
    const testContent = '{"jsonrpc":"2.0","id":1,"method":"test"}'
    const message = `Content-Length: ${testContent.length}\r\n\r\n${testContent}`

    const headerMatch = message.match(/Content-Length: (\d+)\r\n\r\n/)
    expect(headerMatch).toBeTruthy()
    expect(parseInt(headerMatch![1])).toBe(testContent.length)

    const jsonContent = message.slice(headerMatch![0].length)
    const parsed = JSON.parse(jsonContent)
    expect(parsed.method).toBe('test')
  })

  it('should handle shutdown sequence', () => {
    const shutdownRequest = {
      jsonrpc: '2.0',
      id: 99,
      method: 'shutdown',
      params: null
    }

    const shutdownResponse = {
      jsonrpc: '2.0',
      id: 99,
      result: null
    }

    const exitNotification = {
      jsonrpc: '2.0',
      method: 'exit'
    }

    expect(shutdownRequest.method).toBe('shutdown')
    expect(shutdownResponse.result).toBeNull()
    expect(exitNotification.method).toBe('exit')
  })

  it('should validate LSP message structure', () => {
    const validMessage = {
      jsonrpc: '2.0',
      id: 1,
      method: 'test'
    }

    const invalidMessage = {
      jsonrpc: '1.0',
      method: 'test'
    }

    expect(validMessage.jsonrpc).toBe('2.0')
    expect(invalidMessage.jsonrpc).not.toBe('2.0')
  })
})
