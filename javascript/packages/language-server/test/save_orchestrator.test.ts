import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest'

import { Connection, TextDocumentSaveReason, TextEdit } from 'vscode-languageserver/node'
import { TextDocument } from 'vscode-languageserver-textdocument'

import { SaveOrchestrator } from '../src/save_orchestrator'
import { UserSettings } from '../src/user_settings'
import { AutofixService } from '../src/autofix_service'
import { FormattingProvider } from '../src/formatting_provider'
import { Projects } from '../src/projects'
import { Herb } from '@herb-tools/node-wasm'

describe('SaveOrchestrator', () => {
  let connection: Connection
  let userSettings: UserSettings
  let autofixService: AutofixService
  let formattingProvider: FormattingProvider
  let saveOrchestrator: SaveOrchestrator

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

    userSettings = {
      getDocumentSettings: vi.fn()
    } as unknown as UserSettings

    autofixService = {
      autofix: vi.fn()
    } as unknown as AutofixService

    formattingProvider = {
      formatOnSave: vi.fn(),
      formatText: vi.fn()
    } as unknown as FormattingProvider

    const projects = {
      ensure: async () => ({ autofixService, formattingProvider, settingsFor: (uri: string) => userSettings.getDocumentSettings(uri) })
    } as unknown as Projects

    saveOrchestrator = new SaveOrchestrator(connection, projects)
  })

  describe('applyFixesAndFormatting', () => {
    const document = TextDocument.create('file:///test/file.erb', 'erb', 1, '<div>test</div>\n')

    describe('when fixOnSave is false and formatter is disabled', () => {
      it('should return empty array', async () => {
        vi.mocked(userSettings.getDocumentSettings).mockResolvedValue({
          linter: { fixOnSave: false },
          formatter: { enabled: false }
        } as any)

        const result = await saveOrchestrator.applyFixesAndFormatting(
          document,
          TextDocumentSaveReason.Manual
        )

        expect(result).toEqual([])
        expect(autofixService.autofix).not.toHaveBeenCalled()
        expect(formattingProvider.formatOnSave).not.toHaveBeenCalled()
      })
    })

    describe('when fixOnSave is true and formatter is disabled', () => {
      it('should only apply autofix', async () => {
        vi.mocked(userSettings.getDocumentSettings).mockResolvedValue({
          linter: { fixOnSave: true },
          formatter: { enabled: false }
        } as any)

        const autofixEdits: TextEdit[] = [{
          range: { start: { line: 0, character: 0 }, end: { line: 1, character: 0 } },
          newText: '<div>fixed</div>\n'
        }]

        vi.mocked(autofixService.autofix).mockResolvedValue(autofixEdits)

        const result = await saveOrchestrator.applyFixesAndFormatting(
          document,
          TextDocumentSaveReason.Manual
        )

        expect(result).toEqual(autofixEdits)
        expect(autofixService.autofix).toHaveBeenCalledWith(document)
        expect(formattingProvider.formatOnSave).not.toHaveBeenCalled()
      })

      it('should return empty array when autofix returns no changes', async () => {
        vi.mocked(userSettings.getDocumentSettings).mockResolvedValue({
          linter: { fixOnSave: true },
          formatter: { enabled: false }
        } as any)

        vi.mocked(autofixService.autofix).mockResolvedValue([])

        const result = await saveOrchestrator.applyFixesAndFormatting(
          document,
          TextDocumentSaveReason.Manual
        )

        expect(result).toEqual([])
      })
    })

    describe('when fixOnSave is false and formatter is enabled', () => {
      it('should only apply formatting', async () => {
        vi.mocked(userSettings.getDocumentSettings).mockResolvedValue({
          linter: { fixOnSave: false },
          formatter: { enabled: true }
        } as any)

        const formatEdits: TextEdit[] = [{
          range: { start: { line: 0, character: 0 }, end: { line: 1, character: 0 } },
          newText: '<div>\n  test\n</div>\n'
        }]

        vi.mocked(formattingProvider.formatOnSave).mockResolvedValue(formatEdits)

        const result = await saveOrchestrator.applyFixesAndFormatting(
          document,
          TextDocumentSaveReason.Manual
        )

        expect(result).toEqual(formatEdits)
        expect(autofixService.autofix).not.toHaveBeenCalled()
        expect(formattingProvider.formatOnSave).toHaveBeenCalledWith(document, TextDocumentSaveReason.Manual)
      })
    })

    describe('when both fixOnSave and formatter are enabled', () => {
      it('should apply both autofix and formatting', async () => {
        vi.mocked(userSettings.getDocumentSettings).mockResolvedValue({
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
        vi.mocked(formattingProvider.formatOnSave).mockResolvedValue(formatEdits)

        const result = await saveOrchestrator.applyFixesAndFormatting(
          document,
          TextDocumentSaveReason.Manual
        )

        expect(autofixService.autofix).toHaveBeenCalledWith(document)

        expect(formattingProvider.formatOnSave).toHaveBeenCalledWith(
          document,
          TextDocumentSaveReason.Manual,
          '<div>fixed</div>\n'
        )

        expect(result).toEqual(formatEdits)
      })

      it('should return format edits when formatting succeeds', async () => {
        vi.mocked(userSettings.getDocumentSettings).mockResolvedValue({
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
        vi.mocked(formattingProvider.formatOnSave).mockResolvedValue(formatEdits)

        const result = await saveOrchestrator.applyFixesAndFormatting(
          document,
          TextDocumentSaveReason.Manual
        )

        expect(result).toEqual(formatEdits)
      })

      it('should only format when autofix returns no changes', async () => {
        vi.mocked(userSettings.getDocumentSettings).mockResolvedValue({
          linter: { fixOnSave: true },
          formatter: { enabled: true }
        } as any)

        vi.mocked(autofixService.autofix).mockResolvedValue([])

        const formatEdits: TextEdit[] = [{
          range: { start: { line: 0, character: 0 }, end: { line: 1, character: 0 } },
          newText: '<div>\n  test\n</div>\n'
        }]

        vi.mocked(formattingProvider.formatOnSave).mockResolvedValue(formatEdits)

        const result = await saveOrchestrator.applyFixesAndFormatting(
          document,
          TextDocumentSaveReason.Manual
        )

        expect(result).toEqual(formatEdits)
        expect(formattingProvider.formatOnSave).toHaveBeenCalledWith(document, TextDocumentSaveReason.Manual)
      })
    })

    describe('default settings behavior', () => {
      it('should default fixOnSave to true when undefined', async () => {
        vi.mocked(userSettings.getDocumentSettings).mockResolvedValue({
          linter: {}, // fixOnSave is undefined
          formatter: { enabled: false }
        } as any)

        vi.mocked(autofixService.autofix).mockResolvedValue([])

        await saveOrchestrator.applyFixesAndFormatting(
          document,
          TextDocumentSaveReason.Manual
        )

        expect(autofixService.autofix).toHaveBeenCalledWith(document)
      })

      it('should default formatter.enabled to false when undefined', async () => {
        vi.mocked(userSettings.getDocumentSettings).mockResolvedValue({
          linter: { fixOnSave: false },
          formatter: {} // enabled is undefined
        } as any)

        const result = await saveOrchestrator.applyFixesAndFormatting(
          document,
          TextDocumentSaveReason.Manual
        )

        expect(result).toEqual([])
        expect(formattingProvider.formatOnSave).not.toHaveBeenCalled()
      })
    })

    describe('logging', () => {
      it('should log settings values', async () => {
        vi.mocked(userSettings.getDocumentSettings).mockResolvedValue({
          linter: { fixOnSave: true },
          formatter: { enabled: true }
        } as any)

        vi.mocked(autofixService.autofix).mockResolvedValue([])
        vi.mocked(formattingProvider.formatOnSave).mockResolvedValue([])

        await saveOrchestrator.applyFixesAndFormatting(
          document,
          TextDocumentSaveReason.Manual
        )

        expect(connection.console.log).toHaveBeenCalledWith(
          '[DocumentSave] applyFixesAndFormatting fixOnSave=true, formatterEnabled=true'
        )
      })
    })
  })
})
