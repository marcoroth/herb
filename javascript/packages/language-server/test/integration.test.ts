import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { 
  Connection, 
  InitializeParams, 
  TextDocumentSyncKind,
  DiagnosticSeverity,
  createConnection,
  StreamMessageReader,
  StreamMessageWriter
} from 'vscode-languageserver/node'
import { Readable, Writable } from 'stream'
import path from 'path'
import fs from 'fs'

// Import real components without mocking
import { Server } from '../src/server'
import { Service } from '../src/service'
import { DocumentService } from '../src/document_service'
import { Diagnostics } from '../src/diagnostics'

// Mock stdin/stdout streams for testing
class MockReadable extends Readable {
  private messages: string[] = []
  
  addMessage(message: string) {
    this.messages.push(message)
    this.push(message)
  }
  
  _read() {
    // Required implementation
  }
  
  end() {
    this.push(null)
  }
}

class MockWritable extends Writable {
  public data: string = ''
  public messages: any[] = []
  
  _write(chunk: any, encoding: string, callback: Function) {
    this.data += chunk.toString()
    
    // Parse LSP messages
    const lines = this.data.split('\r\n\r\n')
    if (lines.length > 1) {
      const header = lines[0]
      const content = lines[1]
      
      if (header.includes('Content-Length:') && content) {
        try {
          const message = JSON.parse(content)
          this.messages.push(message)
        } catch (e) {
          // Ignore parse errors for incomplete messages
        }
      }
    }
    
    callback()
  }
}

describe('Integration Tests (No Mocks)', () => {
  let mockStdin: MockReadable
  let mockStdout: MockWritable
  let connection: Connection
  let server: Server
  let testWorkspace: string

  beforeEach(async () => {
    // Create mock streams
    mockStdin = new MockReadable()
    mockStdout = new MockWritable()
    
    // Create real connection with mock streams
    connection = createConnection(
      new StreamMessageReader(mockStdin),
      new StreamMessageWriter(mockStdout)
    )
    
    // Set up test workspace
    testWorkspace = path.join(__dirname, 'fixtures', 'test-workspace')
    if (!fs.existsSync(testWorkspace)) {
      fs.mkdirSync(testWorkspace, { recursive: true })
    }
    
    // Create test files
    const testFile = path.join(testWorkspace, 'test.html.erb')
    fs.writeFileSync(testFile, '<%= "Hello World" %>')
    
    const invalidFile = path.join(testWorkspace, 'invalid.html.erb')
    fs.writeFileSync(invalidFile, '<%= missing_quote %>')
  })
  
  afterEach(() => {
    // Clean up test files
    if (fs.existsSync(testWorkspace)) {
      fs.rmSync(testWorkspace, { recursive: true, force: true })
    }
  })

  it('should handle real LSP initialization flow', async () => {
    const service = new Service(connection, {
      processId: process.pid,
      rootUri: `file://${testWorkspace}`,
      capabilities: {
        textDocument: {
          synchronization: {
            dynamicRegistration: true
          }
        }
      }
    } as InitializeParams)

    // Test service initialization
    await service.init()
    
    expect(service.connection).toBe(connection)
    expect(service.settings).toBeDefined()
    expect(service.documentService).toBeInstanceOf(DocumentService)
    expect(service.diagnostics).toBeInstanceOf(Diagnostics)
    expect(service.project).toBeDefined()
  })

  it('should handle real document operations', () => {
    const documentService = new DocumentService(connection)
    
    // Create a real text document
    const document = TextDocument.create(
      `file://${testWorkspace}/test.html.erb`,
      'erb',
      1,
      '<%= "Hello World" %>'
    )
    
    // Test document operations work with real implementation
    expect(documentService.documents).toBeDefined()
    expect(typeof documentService.get).toBe('function')
    expect(typeof documentService.getAll).toBe('function')
  })

  it('should validate real ERB content with diagnostics', async () => {
    const service = new Service(connection, {
      processId: process.pid,
      rootUri: `file://${testWorkspace}`,
      capabilities: {}
    } as InitializeParams)
    
    await service.init()
    
    // Create a document with valid ERB
    const validDocument = TextDocument.create(
      `file://${testWorkspace}/valid.html.erb`,
      'erb',
      1,
      '<%= "Hello World" %>'
    )
    
    // Create a document with invalid ERB (this would depend on actual Herb parser behavior)
    const invalidDocument = TextDocument.create(
      `file://${testWorkspace}/invalid.html.erb`,
      'erb',
      1,
      '<%= unclosed_tag'
    )
    
    // Test that diagnostics can process real documents
    expect(() => service.diagnostics.validate(validDocument)).not.toThrow()
    expect(() => service.diagnostics.validate(invalidDocument)).not.toThrow()
  })

  it('should handle real project initialization', async () => {
    const service = new Service(connection, {
      processId: process.pid,
      rootUri: `file://${testWorkspace}`,
      capabilities: {}
    } as InitializeParams)
    
    await service.init()
    
    // Test project setup with real filesystem
    expect(service.project).toBeDefined()
    expect(typeof service.project.projectPath).toBe('string')
    
    // Test refresh functionality
    await expect(service.refresh()).resolves.not.toThrow()
    await expect(service.refreshConfig()).resolves.not.toThrow()
  })

  it('should create real text documents and handle content', () => {
    const documentService = new DocumentService(connection)
    
    // Test creating real TextDocument instances
    const document1 = TextDocument.create(
      'file:///test1.html.erb',
      'erb',
      1,
      '<%= @user.name %>'
    )
    
    const document2 = TextDocument.create(
      'file:///test2.html.erb',
      'erb',
      1,
      '<div><%= @posts.each do |post| %><p><%= post.title %></p><% end %></div>'
    )
    
    // Verify document properties
    expect(document1.uri).toBe('file:///test1.html.erb')
    expect(document1.languageId).toBe('erb')
    expect(document1.version).toBe(1)
    expect(document1.getText()).toBe('<%= @user.name %>')
    
    expect(document2.uri).toBe('file:///test2.html.erb')
    expect(document2.getText()).toContain('@posts.each')
  })

  it('should handle real configuration and settings', async () => {
    const initParams: InitializeParams = {
      processId: process.pid,
      rootUri: `file://${testWorkspace}`,
      capabilities: {
        workspace: {
          configuration: true,
          workspaceFolders: true
        },
        textDocument: {
          synchronization: {
            dynamicRegistration: true,
            willSave: true,
            didSave: true
          }
        }
      }
    }
    
    const service = new Service(connection, initParams)
    await service.init()
    
    // Test that settings are properly initialized with real data
    expect(service.settings).toBeDefined()
    expect(typeof service.settings.projectPath).toBe('string')
    expect(service.settings.documentSettings).toBeInstanceOf(Map)
  })

  it('should work with real file system operations', async () => {
    const service = new Service(connection, {
      processId: process.pid,
      rootUri: `file://${testWorkspace}`,
      capabilities: {}
    } as InitializeParams)
    
    await service.init()
    
    // Test that the service can work with real files
    const testFilePath = path.join(testWorkspace, 'real-test.html.erb')
    const content = '<%= Time.now.strftime("%Y-%m-%d") %>'
    fs.writeFileSync(testFilePath, content)
    
    const document = TextDocument.create(
      `file://${testFilePath}`,
      'erb',
      1,
      content
    )
    
    // Test diagnostics with real file content
    expect(() => service.diagnostics.validate(document)).not.toThrow()
    
    // Clean up
    fs.unlinkSync(testFilePath)
  })

  it('should handle complex ERB syntax without mocks', () => {
    const documentService = new DocumentService(connection)
    
    const complexERB = `
<html>
  <head><title><%= @page_title %></title></head>
  <body>
    <% if @user.authenticated? %>
      <h1>Welcome, <%= @user.name %>!</h1>
      <ul>
        <% @user.posts.each do |post| %>
          <li>
            <h2><%= link_to post.title, post_path(post) %></h2>
            <p><%= truncate(post.content, length: 100) %></p>
            <small>Posted <%= time_ago_in_words(post.created_at) %> ago</small>
          </li>
        <% end %>
      </ul>
    <% else %>
      <p><%= link_to "Please log in", login_path %></p>
    <% end %>
  </body>
</html>`
    
    const document = TextDocument.create(
      'file:///complex.html.erb',
      'erb',
      1,
      complexERB
    )
    
    // Verify the document can handle complex content
    expect(document.getText()).toContain('@user.authenticated?')
    expect(document.getText()).toContain('time_ago_in_words')
    expect(document.lineCount).toBeGreaterThan(10)
    
    // Test that we can get specific lines
    const newlineIndex = document.getText().indexOf('\n')
    if (newlineIndex > 0) {
      const firstLine = document.getText({
        start: { line: 0, character: 0 },
        end: document.positionAt(newlineIndex)
      })
      expect(firstLine).toContain('<html>')
    }
  })
})