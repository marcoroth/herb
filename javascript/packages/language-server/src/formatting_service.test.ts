import dedent from 'dedent'

import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest'

import { Connection, TextDocuments, DocumentFormattingParams } from 'vscode-languageserver/node'
import { TextDocument } from 'vscode-languageserver-textdocument'

import { FormattingService } from './formatting_service'
import { Project } from './project'
import { Settings } from './settings'

import { Herb } from '@herb-tools/node-wasm'

describe('FormattingService', () => {
  let connection: Connection
  let documents: TextDocuments<TextDocument>
  let project: Project
  let settings: Settings
  let formattingService: FormattingService

  beforeAll(async () => {
    await Herb.load()
  })

  beforeEach(() => {
    connection = {
      console: {
        log: vi.fn(),
        error: vi.fn()
      }
    } as unknown as Connection

    documents = {
      get: vi.fn()
    } as unknown as TextDocuments<TextDocument>

    project = {
      projectPath: '/test/project',
      herbBackend: Herb
    } as unknown as Project

    settings = {
      getDocumentSettings: vi.fn()
    } as unknown as Settings

    formattingService = new FormattingService(connection, documents, project, settings)
  })

  describe('formatDocument', () => {
    const params: DocumentFormattingParams = {
      textDocument: { uri: 'file:///test/file.erb' },
      options: { tabSize: 2, insertSpaces: true }
    }

    it('should handle null settings gracefully', async () => {
      vi.mocked(settings.getDocumentSettings).mockResolvedValue(null as any)

      const input = '<div>test</div>'
      const document = TextDocument.create('file:///test/file.erb', 'erb', 1, input)
      vi.mocked(documents.get).mockReturnValue(document)

      const result = await formattingService.formatDocument(params)

      expect(result).toBeDefined()
      expect(result.length).toBeGreaterThan(0)
      expect(result[0].newText).toBe('<div>test</div>\n')
    })

    it('should handle settings without formatter property', async () => {
      vi.mocked(settings.getDocumentSettings).mockResolvedValue({} as any)

      const document = TextDocument.create('file:///test/file.erb', 'erb', 1, '<div>test</div>')
      vi.mocked(documents.get).mockReturnValue(document)

      const result = await formattingService.formatDocument(params)

      expect(result).toBeDefined()
      expect(result.length).toBeGreaterThan(0)
    })

    it('should respect formatter.enabled = false in settings', async () => {
      vi.mocked(settings.getDocumentSettings).mockResolvedValue({
        formatter: { enabled: false }
      } as any)

      const result = await formattingService.formatDocument(params)

      expect(result).toEqual([])
    })

    it('should use default options when settings are null', async () => {
      vi.mocked(settings.getDocumentSettings).mockResolvedValue(null as any)

      const input = dedent`
        <div>
        <h1>Title</h1>
        <p>Some content that is long enough to force multi-line formatting</p>
        <div>
        <span>Nested content</span>
        </div>
        </div>
      `
      const document = TextDocument.create('file:///test/file.erb', 'erb', 1, input)
      vi.mocked(documents.get).mockReturnValue(document)

      const result = await formattingService.formatDocument(params)

      const expected = dedent`
        <div>
          <h1>Title</h1>
          <p>Some content that is long enough to force multi-line formatting</p>
          <div>
            <span>Nested content</span>
          </div>
        </div>
      ` + '\n'

      expect(result[0].newText).toBe(expected)
    })

    it('should merge settings properly when available', async () => {
      vi.mocked(settings.getDocumentSettings).mockResolvedValue({
        formatter: {
          enabled: true,
          indentWidth: 4,
          maxLineLength: 120
        }
      } as any)

      const input = dedent`
        <div>
        <h1>Title</h1>
        <p>Content with multiple elements</p>
        <div>
        <span>Nested</span>
        </div>
        </div>
      `
      const document = TextDocument.create('file:///test/file.erb', 'erb', 1, input)
      vi.mocked(documents.get).mockReturnValue(document)

      const result = await formattingService.formatDocument(params)

      const expected = dedent`
        <div>
            <h1>Title</h1>
            <p>Content with multiple elements</p>
            <div>
                <span>Nested</span>
            </div>
        </div>
      ` + '\n'

      expect(result[0].newText).toBe(expected)
    })

    it('should return empty array when document is not found', async () => {
      vi.mocked(settings.getDocumentSettings).mockResolvedValue({} as any)
      vi.mocked(documents.get).mockReturnValue(undefined)

      const result = await formattingService.formatDocument(params)

      expect(result).toEqual([])
    })

    it('should handle formatting errors gracefully', async () => {
      vi.mocked(settings.getDocumentSettings).mockResolvedValue({} as any)

      const document = TextDocument.create('file:///test/file.erb', 'erb', 1, '<div><% if true %></div><% end %>')
      vi.mocked(documents.get).mockReturnValue(document)

      const result = await formattingService.formatDocument(params)

      expect(result).toBeDefined()
    })

    it('should handle ERB content correctly', async () => {
      vi.mocked(settings.getDocumentSettings).mockResolvedValue({} as any)

      const input = '<div><% if user.admin? %><p>Admin</p><% end %></div>'
      const document = TextDocument.create('file:///test/file.erb', 'erb', 1, input)
      vi.mocked(documents.get).mockReturnValue(document)

      const result = await formattingService.formatDocument(params)

      const expected = dedent`
        <div>
          <% if user.admin? %>
            <p>Admin</p>
          <% end %>
        </div>
      ` + '\n'

      expect(result[0].newText).toBe(expected)
    })
  })

  describe('formatDocumentIgnoreConfig', () => {
    it('should format even with null settings', async () => {
      const params: DocumentFormattingParams = {
        textDocument: { uri: 'file:///test/file.erb' },
        options: { tabSize: 2, insertSpaces: true }
      }

      vi.mocked(settings.getDocumentSettings).mockResolvedValue(null as any)

      const document = TextDocument.create('file:///test/file.erb', 'erb', 1, '<div>test</div>')
      vi.mocked(documents.get).mockReturnValue(document)

      const result = await formattingService.formatDocumentIgnoreConfig(params)

      expect(result).toBeDefined()
      expect(result.length).toBeGreaterThan(0)
    })
  })
})
