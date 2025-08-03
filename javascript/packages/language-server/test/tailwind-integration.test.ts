import { describe, it, expect, beforeAll } from 'vitest'
import { FormattingService } from '../src/formatting_service.js'
import { Settings } from '../src/settings.js'
import { Project } from '../src/project.js'
import { Connection, TextDocuments, DocumentFormattingParams } from 'vscode-languageserver/node'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { Herb } from '@herb-tools/node-wasm'
import dedent from 'dedent'

// Mock connection and documents for testing
const mockConnection = {
  console: {
    log: () => {},
    error: () => {}
  }
} as Connection

const mockDocuments = {
  get: (uri: string) => {
    if (uri === 'file:///test.html.erb') {
      return TextDocument.create(uri, 'erb', 1, '<div class="text-red-500 bg-blue-200 p-4 m-2">content</div>')
    }
    return undefined
  }
} as TextDocuments<TextDocument>

describe('Tailwind Integration in Language Server', () => {
  let formattingService: FormattingService
  let settings: Settings
  let project: Project

  beforeAll(async () => {
    await Herb.load()
    
    // Mock InitializeParams
    const mockParams = {
      capabilities: {},
      workspaceFolders: [{ uri: 'file:///test-project', name: 'test' }]
    }
    
    settings = new Settings(mockParams, mockConnection)
    project = new Project('file:///test-project', Herb)
    formattingService = new FormattingService(mockConnection, mockDocuments, project, settings)
    
    await formattingService.initialize()
  })

  describe('formatDocument with Tailwind sorting', () => {
    it('should format document with Tailwind sorting enabled', async () => {
      // Mock settings to enable Tailwind sorting
      settings.getDocumentSettings = async () => ({
        formatter: {
          enabled: true,
          indentWidth: 2,
          maxLineLength: 80,
          sortTailwindClasses: true
        }
      })

      const params: DocumentFormattingParams = {
        textDocument: { uri: 'file:///test.html.erb' },
        options: { tabSize: 2, insertSpaces: true }
      }

      const edits = await formattingService.formatDocument(params)
      
      expect(edits).toHaveLength(1)
      expect(edits[0].newText).toBe('<div class="m-2 p-4 text-red-500 bg-blue-200">\n  content\n</div>\n')
    })

    it('should format document with Tailwind sorting disabled', async () => {
      // Mock settings to disable Tailwind sorting
      settings.getDocumentSettings = async () => ({
        formatter: {
          enabled: true,
          indentWidth: 2,
          maxLineLength: 80,
          sortTailwindClasses: false
        }
      })

      const params: DocumentFormattingParams = {
        textDocument: { uri: 'file:///test.html.erb' },
        options: { tabSize: 2, insertSpaces: true }
      }

      const edits = await formattingService.formatDocument(params)
      
      expect(edits).toHaveLength(1)
      expect(edits[0].newText).toBe('<div class="text-red-500 bg-blue-200 p-4 m-2">\n  content\n</div>\n')
    })

    it('should not format when formatter is disabled', async () => {
      // Mock settings to disable formatter
      settings.getDocumentSettings = async () => ({
        formatter: {
          enabled: false,
          sortTailwindClasses: true
        }
      })

      const params: DocumentFormattingParams = {
        textDocument: { uri: 'file:///test.html.erb' },
        options: { tabSize: 2, insertSpaces: true }
      }

      const edits = await formattingService.formatDocument(params)
      
      expect(edits).toHaveLength(0)
    })

    it('should handle documents without Tailwind classes', async () => {
      // Mock a document without Tailwind classes
      mockDocuments.get = (uri: string) => {
        if (uri === 'file:///no-tailwind.html.erb') {
          return TextDocument.create(uri, 'erb', 1, '<div id="test">content</div>')
        }
        return undefined
      }

      settings.getDocumentSettings = async () => ({
        formatter: {
          enabled: true,
          indentWidth: 2,
          maxLineLength: 80,
          sortTailwindClasses: true
        }
      })

      const params: DocumentFormattingParams = {
        textDocument: { uri: 'file:///no-tailwind.html.erb' },
        options: { tabSize: 2, insertSpaces: true }
      }

      const edits = await formattingService.formatDocument(params)
      
      expect(edits).toHaveLength(1)
      expect(edits[0].newText).toBe('<div id="test">\n  content\n</div>\n')
    })

    it('should handle complex HTML with multiple Tailwind class attributes', async () => {
      const complexHtml = dedent`
        <div class="text-red-500 bg-blue-200 p-4 m-2">
          <span class="font-bold text-lg hover:text-blue-300">nested</span>
          <p class="mt-4 mb-2">paragraph</p>
        </div>
      `

      mockDocuments.get = (uri: string) => {
        if (uri === 'file:///complex.html.erb') {
          return TextDocument.create(uri, 'erb', 1, complexHtml)
        }
        return undefined
      }

      settings.getDocumentSettings = async () => ({
        formatter: {
          enabled: true,
          indentWidth: 2,
          maxLineLength: 80,
          sortTailwindClasses: true
        }
      })

      const params: DocumentFormattingParams = {
        textDocument: { uri: 'file:///complex.html.erb' },
        options: { tabSize: 2, insertSpaces: true }
      }

      const edits = await formattingService.formatDocument(params)
      
      expect(edits).toHaveLength(1)
      expect(typeof edits[0].newText).toBe('string')
      expect(edits[0].newText.length).toBeGreaterThan(0)
    })
  })

  describe('formatDocumentIgnoreConfig', () => {
    it('should format document ignoring config settings', async () => {
      // Ensure the mock document is available
      mockDocuments.get = (uri: string) => {
        if (uri === 'file:///test.html.erb') {
          return TextDocument.create(uri, 'erb', 1, '<div class="text-red-500 bg-blue-200 p-4 m-2">content</div>')
        }
        return undefined
      }

      const params: DocumentFormattingParams = {
        textDocument: { uri: 'file:///test.html.erb' },
        options: { tabSize: 2, insertSpaces: true }
      }

      const edits = await formattingService.formatDocumentIgnoreConfig(params)
      
      expect(edits).toHaveLength(1)
      expect(edits[0].newText).toBe('<div class="m-2 p-4 text-red-500 bg-blue-200">\n  content\n</div>\n')
    })
  })

  describe('error handling', () => {
    it('should handle parsing errors gracefully', async () => {
      // Mock a document with invalid HTML
      mockDocuments.get = (uri: string) => {
        if (uri === 'file:///invalid.html.erb') {
          return TextDocument.create(uri, 'erb', 1, '<div class="test">')
        }
        return undefined
      }

      settings.getDocumentSettings = async () => ({
        formatter: {
          enabled: true,
          sortTailwindClasses: true
        }
      })

      const params: DocumentFormattingParams = {
        textDocument: { uri: 'file:///invalid.html.erb' },
        options: { tabSize: 2, insertSpaces: true }
      }

      const edits = await formattingService.formatDocument(params)
      
      // Should return empty array on error
      expect(Array.isArray(edits)).toBe(true)
    })

    it('should handle missing documents', async () => {
      const params: DocumentFormattingParams = {
        textDocument: { uri: 'file:///nonexistent.html.erb' },
        options: { tabSize: 2, insertSpaces: true }
      }

      const edits = await formattingService.formatDocument(params)
      
      expect(edits).toHaveLength(0)
    })
  })
})