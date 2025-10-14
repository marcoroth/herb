import dedent from 'dedent'

import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest'

import { Connection, TextDocuments, DocumentFormattingParams, DocumentRangeFormattingParams, Range, Position } from 'vscode-languageserver/node'
import { TextDocument } from 'vscode-languageserver-textdocument'

import { FormattingService } from '../src/formatting_service'
import { Project } from '../src/project'
import { Settings } from '../src/settings'

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

          <div><span>Nested content</span></div>
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

            <div><span>Nested</span></div>
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

  describe('formatRange', () => {
    const createRangeParams = (range: Range): DocumentRangeFormattingParams => ({
      textDocument: { uri: 'file:///test/file.erb' },
      range,
      options: { tabSize: 2, insertSpaces: true }
    })

    it('should format a selected range', async () => {
      vi.mocked(settings.getDocumentSettings).mockResolvedValue({} as any)

      const input = dedent`
        <div>
          <span>unformatted</span><p>content</p>
        </div>
      `
      const document = TextDocument.create('file:///test/file.erb', 'erb', 1, input)
      vi.mocked(documents.get).mockReturnValue(document)

      const range: Range = {
        start: Position.create(1, 2),
        end: Position.create(1, 37)
      }

      const params = createRangeParams(range)
      const result = await formattingService.formatRange(params)

      expect(result).toBeDefined()

      if (result.length > 0) {
        expect(result[0].range).toEqual(range)
      }
    })

    it('should format even when formatter.enabled = false (explicit user action)', async () => {
      vi.mocked(settings.getDocumentSettings).mockResolvedValue({
        formatter: { enabled: false }
      } as any)

      const input = '<div><span>test</span></div>'
      const document = TextDocument.create('file:///test/file.erb', 'erb', 1, input)

      vi.mocked(documents.get).mockReturnValue(document)

      const params = createRangeParams({
        start: Position.create(0, 0),
        end: Position.create(0, 28)
      })

      const result = await formattingService.formatRange(params)

      expect(result).toBeDefined()
    })

    it('should handle null settings gracefully', async () => {
      vi.mocked(settings.getDocumentSettings).mockResolvedValue(null as any)

      const input = '<div><span>test</span></div>'
      const document = TextDocument.create('file:///test/file.erb', 'erb', 1, input)

      vi.mocked(documents.get).mockReturnValue(document)

      const range: Range = {
        start: Position.create(0, 5),
        end: Position.create(0, 22)
      }

      const params = createRangeParams(range)
      const result = await formattingService.formatRange(params)

      expect(result).toBeDefined()
    })

    it('should return empty array when document is not found', async () => {
      vi.mocked(settings.getDocumentSettings).mockResolvedValue({} as any)
      vi.mocked(documents.get).mockReturnValue(undefined)

      const params = createRangeParams({
        start: Position.create(0, 0),
        end: Position.create(0, 10)
      })

      const result = await formattingService.formatRange(params)

      expect(result).toEqual([])
    })

    it('should handle ERB content in range', async () => {
      vi.mocked(settings.getDocumentSettings).mockResolvedValue({} as any)

      const input = '<div><% if user.admin? %><p>Admin</p><% end %></div>'
      const document = TextDocument.create('file:///test/file.erb', 'erb', 1, input)

      vi.mocked(documents.get).mockReturnValue(document)

      const range: Range = {
        start: Position.create(0, 5),
        end: Position.create(0, 44)
      }

      const params = createRangeParams(range)
      const result = await formattingService.formatRange(params)

      expect(result).toBeDefined()
      if (result.length > 0) {
        expect(result[0].newText).toContain('<% if user.admin? %>')
      }
    })

    it('should preserve base indentation', async () => {
      vi.mocked(settings.getDocumentSettings).mockResolvedValue({} as any)

      const input = dedent`
        <div>
            <span>test</span><p>content</p>
        </div>
      `
      const document = TextDocument.create('file:///test/file.erb', 'erb', 1, input)
      vi.mocked(documents.get).mockReturnValue(document)

      const range: Range = {
        start: Position.create(1, 4),
        end: Position.create(1, 34)
      }

      const params = createRangeParams(range)
      const result = await formattingService.formatRange(params)

      expect(result).toBeDefined()

      if (result.length > 0) {
        expect(result[0].newText).toMatch(/^\s*<span>test<\/span>/)
      }
    })
  })

  describe('formatRangeIgnoreConfig', () => {
    it('should format range even with null settings', async () => {
      vi.mocked(settings.getDocumentSettings).mockResolvedValue(null as any)

      const input = '<div><span>test</span></div>'
      const document = TextDocument.create('file:///test/file.erb', 'erb', 1, input)

      vi.mocked(documents.get).mockReturnValue(document)

      const range: Range = {
        start: Position.create(0, 5),
        end: Position.create(0, 22)
      }

      const params: DocumentRangeFormattingParams = {
        textDocument: { uri: 'file:///test/file.erb' },
        range,
        options: { tabSize: 2, insertSpaces: true }
      }

      const result = await formattingService.formatRangeIgnoreConfig(params)

      expect(result).toBeDefined()
    })

    it('should calculate minimum indentation across all selected lines', async () => {
      const input = dedent`
        <div>
          <div>
            <div>
              <p>some <%= formatted %> text, that needs <% needs %> <% to_be_formatted %> without being reset to the <b><i>start of the line</i></b>.</p>
            </div>
          </div>
        </div>
      `

      const document = TextDocument.create('file:///test/file.erb', 'erb', 1, input)
      vi.mocked(documents.get).mockReturnValue(document)

      const range: Range = {
        start: Position.create(3, 0),
        end: Position.create(3, 150)
      }

      const params: DocumentRangeFormattingParams = {
        textDocument: { uri: 'file:///test/file.erb' },
        range,
        options: { tabSize: 2, insertSpaces: true }
      }

      const result = await formattingService.formatRange(params)

      expect(result[0].newText).toBe(
        '      <p>\n' +
        '        some <%= formatted %> text, that needs <% needs %> <% to_be_formatted %>\n' +
        '        without being reset to the <b><i>start of the line</i></b>.\n' +
        '      </p>\n'
      )
    })
  })
})
