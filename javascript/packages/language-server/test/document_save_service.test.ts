import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest'

import { Connection, TextDocumentSaveReason, TextEdit } from 'vscode-languageserver/node'
import { TextDocument } from 'vscode-languageserver-textdocument'

import { DocumentSaveService } from '../src/document_save_service'
import { Settings } from '../src/settings'
import { AutofixService } from '../src/autofix_service'
import { FormattingService } from '../src/formatting_service'
import { Herb } from '@herb-tools/node-wasm'

describe('DocumentSaveService', () => {
  let connection: Connection
  let settings: Settings
  let autofixService: AutofixService
  let formattingService: FormattingService
  let documentSaveService: DocumentSaveService

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

    settings = {
      getDocumentSettings: vi.fn()
    } as unknown as Settings

    autofixService = {
      autofix: vi.fn()
    } as unknown as AutofixService

    formattingService = {
      formatOnSave: vi.fn(),
      formatText: vi.fn()
    } as unknown as FormattingService

    documentSaveService = new DocumentSaveService(
      connection,
      settings,
      autofixService,
      formattingService
    )
  })

  describe('applyFixesAndFormatting', () => {
    const document = TextDocument.create('file:///test/file.erb', 'erb', 1, '<div>test</div>\n')

    describe('when fixOnSave is false and formatter is disabled', () => {
      it('should return empty array', async () => {
        vi.mocked(settings.getDocumentSettings).mockResolvedValue({
          linter: { fixOnSave: false },
          formatter: { enabled: false }
        } as any)

        const result = await documentSaveService.applyFixesAndFormatting(
          document,
          TextDocumentSaveReason.Manual
        )

        expect(result).toEqual([])
        expect(autofixService.autofix).not.toHaveBeenCalled()
        expect(formattingService.formatOnSave).not.toHaveBeenCalled()
      })
    })

    describe('when fixOnSave is true and formatter is disabled', () => {
      it('should only apply autofix', async () => {
        vi.mocked(settings.getDocumentSettings).mockResolvedValue({
          linter: { fixOnSave: true },
          formatter: { enabled: false }
        } as any)

        const autofixEdits: TextEdit[] = [{
          range: { start: { line: 0, character: 0 }, end: { line: 1, character: 0 } },
          newText: '<div>fixed</div>\n'
        }]

        vi.mocked(autofixService.autofix).mockResolvedValue(autofixEdits)

        const result = await documentSaveService.applyFixesAndFormatting(
          document,
          TextDocumentSaveReason.Manual
        )

        expect(result).toEqual(autofixEdits)
        expect(autofixService.autofix).toHaveBeenCalledWith(document)
        expect(formattingService.formatOnSave).not.toHaveBeenCalled()
      })

      it('should return empty array when autofix returns no changes', async () => {
        vi.mocked(settings.getDocumentSettings).mockResolvedValue({
          linter: { fixOnSave: true },
          formatter: { enabled: false }
        } as any)

        vi.mocked(autofixService.autofix).mockResolvedValue([])

        const result = await documentSaveService.applyFixesAndFormatting(
          document,
          TextDocumentSaveReason.Manual
        )

        expect(result).toEqual([])
      })
    })

    describe('when fixOnSave is false and formatter is enabled', () => {
      it('should only apply formatting', async () => {
        vi.mocked(settings.getDocumentSettings).mockResolvedValue({
          linter: { fixOnSave: false },
          formatter: { enabled: true }
        } as any)

        const formatEdits: TextEdit[] = [{
          range: { start: { line: 0, character: 0 }, end: { line: 1, character: 0 } },
          newText: '<div>\n  test\n</div>\n'
        }]

        vi.mocked(formattingService.formatOnSave).mockResolvedValue(formatEdits)

        const result = await documentSaveService.applyFixesAndFormatting(
          document,
          TextDocumentSaveReason.Manual
        )

        expect(result).toEqual(formatEdits)
        expect(autofixService.autofix).not.toHaveBeenCalled()
        expect(formattingService.formatOnSave).toHaveBeenCalledWith(document, TextDocumentSaveReason.Manual)
      })
    })

    describe('when both fixOnSave and formatter are enabled', () => {
      it('should apply both autofix and formatting', async () => {
        vi.mocked(settings.getDocumentSettings).mockResolvedValue({
          linter: { fixOnSave: true },
          formatter: { enabled: true }
        } as any)

        const autofixEdits: TextEdit[] = [{
          range: { start: { line: 0, character: 0 }, end: { line: 1, character: 0 } },
          newText: '<div>fixed</div>\n'
        }]

        const formatEdits: TextEdit[] = [{
          range: { start: { line: 0, character: 0 }, end: { line: 1, character: 0 } },
          newText: '<div>\n  fixed\n</div>\n'
        }]

        vi.mocked(autofixService.autofix).mockResolvedValue(autofixEdits)
        vi.mocked(formattingService.formatOnSave).mockResolvedValue(formatEdits)

        const result = await documentSaveService.applyFixesAndFormatting(
          document,
          TextDocumentSaveReason.Manual
        )

        expect(autofixService.autofix).toHaveBeenCalledWith(document)

        expect(formattingService.formatOnSave).toHaveBeenCalled()

        const callArgs = vi.mocked(formattingService.formatOnSave).mock.calls[0]
        expect(callArgs[0].uri).toBe(document.uri)
        expect(callArgs[0].getText()).toBe('<div>fixed</div>\n')
        expect(callArgs[1]).toBe(TextDocumentSaveReason.Manual)

        expect(result).toEqual(formatEdits)
      })

      it('should return format edits when formatting succeeds', async () => {
        vi.mocked(settings.getDocumentSettings).mockResolvedValue({
          linter: { fixOnSave: true },
          formatter: { enabled: true }
        } as any)

        const autofixEdits: TextEdit[] = [{
          range: { start: { line: 0, character: 0 }, end: { line: 1, character: 0 } },
          newText: '<div>fixed</div>\n'
        }]

        const formatEdits: TextEdit[] = [{
          range: { start: { line: 0, character: 0 }, end: { line: 1, character: 0 } },
          newText: '<div>\n  fixed\n</div>\n'
        }]

        vi.mocked(autofixService.autofix).mockResolvedValue(autofixEdits)
        vi.mocked(formattingService.formatOnSave).mockResolvedValue(formatEdits)

        const result = await documentSaveService.applyFixesAndFormatting(
          document,
          TextDocumentSaveReason.Manual
        )

        expect(result).toEqual(formatEdits)
      })

      it('should only format when autofix returns no changes', async () => {
        vi.mocked(settings.getDocumentSettings).mockResolvedValue({
          linter: { fixOnSave: true },
          formatter: { enabled: true }
        } as any)

        vi.mocked(autofixService.autofix).mockResolvedValue([])

        const formatEdits: TextEdit[] = [{
          range: { start: { line: 0, character: 0 }, end: { line: 1, character: 0 } },
          newText: '<div>\n  test\n</div>\n'
        }]

        vi.mocked(formattingService.formatOnSave).mockResolvedValue(formatEdits)

        const result = await documentSaveService.applyFixesAndFormatting(
          document,
          TextDocumentSaveReason.Manual
        )

        expect(result).toEqual(formatEdits)
        expect(formattingService.formatOnSave).toHaveBeenCalledWith(document, TextDocumentSaveReason.Manual)
      })
    })

    describe('default settings behavior', () => {
      it('should default fixOnSave to true when undefined', async () => {
        vi.mocked(settings.getDocumentSettings).mockResolvedValue({
          linter: {}, // fixOnSave is undefined
          formatter: { enabled: false }
        } as any)

        vi.mocked(autofixService.autofix).mockResolvedValue([])

        await documentSaveService.applyFixesAndFormatting(
          document,
          TextDocumentSaveReason.Manual
        )

        expect(autofixService.autofix).toHaveBeenCalledWith(document)
      })

      it('should default formatter.enabled to false when undefined', async () => {
        vi.mocked(settings.getDocumentSettings).mockResolvedValue({
          linter: { fixOnSave: false },
          formatter: {} // enabled is undefined
        } as any)

        const result = await documentSaveService.applyFixesAndFormatting(
          document,
          TextDocumentSaveReason.Manual
        )

        expect(result).toEqual([])
        expect(formattingService.formatOnSave).not.toHaveBeenCalled()
      })
    })

    describe('logging', () => {
      it('should log settings values', async () => {
        vi.mocked(settings.getDocumentSettings).mockResolvedValue({
          linter: { fixOnSave: true },
          formatter: { enabled: true }
        } as any)

        vi.mocked(autofixService.autofix).mockResolvedValue([])
        vi.mocked(formattingService.formatOnSave).mockResolvedValue([])

        await documentSaveService.applyFixesAndFormatting(
          document,
          TextDocumentSaveReason.Manual
        )

        expect(connection.console.log).toHaveBeenCalledWith(
          '[DocumentSave] fixOnSave=true, formatterEnabled=true'
        )
      })
    })
  })
})
