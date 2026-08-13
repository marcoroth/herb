import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest'

import { Connection } from 'vscode-languageserver/node'
import { TextDocument } from 'vscode-languageserver-textdocument'

import { AutofixService } from '../src/autofix_service'
import { Config } from '@herb-tools/config'
import { Herb } from '@herb-tools/node-wasm'

import type { Project } from '../src/project'
import type { PersonalHerbSettings } from '../src/user_settings'

describe('AutofixService', () => {
  let connection: Connection
  let autofixService: AutofixService

  const projectWith = (settings: Partial<PersonalHerbSettings> = {}) => {
    return { root: '/test', settingsFor: async () => settings } as unknown as Project
  }

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

    autofixService = new AutofixService(connection, projectWith())
  })

  describe('autofix', () => {
    it('should return empty array when there are no offenses', async () => {
      const document = TextDocument.create('file:///test/file.erb', 'erb', 1, '<div>test</div>\n')
      const result = await autofixService.autofix(document)

      expect(result).toEqual([])
    })

    it('should fix uppercase tag names', async () => {
      const input = '<DIV><SPAN>test</SPAN></DIV>\n'
      const document = TextDocument.create('file:///test/file.erb', 'erb', 1, input)
      const result = await autofixService.autofix(document)

      expect(result).toHaveLength(1)
      expect(result[0].newText).toBe('<div><span>test</span></div>\n')
    })

    it('should return empty array when text is unchanged after autofix', async () => {
      const input = '<div>test</div>\n'
      const document = TextDocument.create('file:///test/file.erb', 'erb', 1, input)
      const result = await autofixService.autofix(document)

      expect(result).toEqual([])
    })

    it('should handle multiple fixable offenses', async () => {
      const input = '<DIV><SPAN>test</SPAN><P>paragraph</P></DIV>\n'
      const document = TextDocument.create('file:///test/file.erb', 'erb', 1, input)
      const result = await autofixService.autofix(document)

      expect(result).toHaveLength(1)
      expect(result[0].newText).toBe('<div><span>test</span><p>paragraph</p></div>\n')
    })

    it('should handle ERB content correctly', async () => {
      const input = '<DIV><% if true %><SPAN>test</SPAN><% end %></DIV>\n'
      const document = TextDocument.create('file:///test/file.erb', 'erb', 1, input)
      const result = await autofixService.autofix(document)

      expect(result).toHaveLength(1)
      expect(result[0].newText).toBe('<div><% if true %><span>test</span><% end %></div>\n')
    })

    it('should handle documents with no fixable offenses', async () => {
      const input = '<h2>Content<h3>'
      const document = TextDocument.create('file:///test/file.erb', 'erb', 1, input)
      const result = await autofixService.autofix(document)

      expect(result).toEqual([])
    })

    it('should replace the full document range', async () => {
      const input = '<DIV>test</DIV>\n'
      const document = TextDocument.create('file:///test/file.erb', 'erb', 1, input)
      const result = await autofixService.autofix(document)

      expect(result).toHaveLength(1)
      expect(result[0].range).toEqual({
        start: { line: 0, character: 0 },
        end: { line: 1, character: 0 }
      })
    })
  })

  describe('with custom config', () => {
    it('should respect config rules', async () => {
      const config = Config.fromObject({
        linter: {
          enabled: true,
          rules: {
            'html-tag-name-lowercase': { enabled: false }
          }
        }
      }, { projectPath: '/test', version: '0.10.3' })

      autofixService.setConfig(config)

      const input = '<DIV>test</DIV>\n'
      const document = TextDocument.create('file:///test/file.erb', 'erb', 1, input)
      const result = await autofixService.autofix(document)

      expect(result).toEqual([])
    })

    it('should rebuild linter when config changes', async () => {
      const config1 = Config.fromObject({
        linter: { enabled: true }
      }, { projectPath: '/test', version: '0.10.3' })

      autofixService.setConfig(config1)

      const input = '<DIV>test</DIV>\n'
      const document = TextDocument.create('file:///test/file.erb', 'erb', 1, input)
      const result1 = await autofixService.autofix(document)

      expect(result1).toHaveLength(1)

      const config2 = Config.fromObject({
        linter: {
          enabled: true,
          rules: {
            'html-tag-name-lowercase': { enabled: false }
          }
        }
      }, { projectPath: '/test', version: '0.10.3' })

      autofixService.setConfig(config2)

      const result2 = await autofixService.autofix(document)

      expect(result2).toEqual([])
    })
  })

  describe('with a resolved indent style', () => {
    it('should fix indentation to the style the diagnostics were reported against', async () => {
      const project = projectWith({ formatter: { indentStyle: 'tab', indentWidth: 2 } })
      const service = new AutofixService(connection, project)

      const document = TextDocument.create('file:///test/file.erb', 'erb', 1, '<div>\n  <span>test</span>\n</div>\n')
      const result = await service.autofix(document)

      expect(result).toHaveLength(1)
      expect(result[0].newText).toBe('<div>\n\t<span>test</span>\n</div>\n')
    })

    it('should leave indentation alone when the style already matches', async () => {
      const project = projectWith({ formatter: { indentStyle: 'tab', indentWidth: 2 } })
      const service = new AutofixService(connection, project)

      const document = TextDocument.create('file:///test/file.erb', 'erb', 1, '<div>\n\t<span>test</span>\n</div>\n')
      const result = await service.autofix(document)

      expect(result).toEqual([])
    })
  })
})
