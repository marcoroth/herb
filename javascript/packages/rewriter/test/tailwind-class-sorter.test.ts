import { describe, it, expect, beforeAll } from 'vitest'
import { TailwindClassSorter } from '../src/rewriters/tailwind-class-sorter/index.js'
import { Herb } from '@herb-tools/node-wasm'

describe('TailwindClassSorter', () => {
  beforeAll(async () => {
    await Herb.load()
  })

  describe('constructor and configuration', () => {
    it('should create with default options', () => {
      const sorter = new TailwindClassSorter()
      expect(sorter.isEnabled()).toBe(true)
    })

    it('should create with custom options', () => {
      const sorter = new TailwindClassSorter({ enabled: false, verbose: true })
      expect(sorter.isEnabled()).toBe(false)
    })

    it('should create with partial options', () => {
      const sorter = new TailwindClassSorter({ verbose: true })
      expect(sorter.isEnabled()).toBe(true)
    })
  })

  describe('process method', () => {
    it('should return not modified when disabled', () => {
      const sorter = new TailwindClassSorter({ enabled: false })
      const source = '<div class="text-red-500 bg-blue-200">content</div>'
      const parseResult = Herb.parse(source)

      if (parseResult.failed) {
        throw new Error('Parse failed')
      }

      const result = sorter.process(parseResult.value)

      expect(result.modified).toBe(false)
      expect(result.statistics.total).toBe(0)
      expect(result.statistics.modified).toBe(0)
      expect(result.statistics.skipped).toBe(0)
    })

    it('should process HTML with Tailwind classes', () => {
      const sorter = new TailwindClassSorter({ enabled: true, verbose: false })
      const source = '<div class="text-red-500 bg-blue-200 p-4 m-2">content</div>'
      const parseResult = Herb.parse(source)

      if (parseResult.failed) {
        throw new Error('Parse failed')
      }

      const result = sorter.process(parseResult.value)

      // The sorter should find and sort the Tailwind classes
      expect(result.modified).toBe(true)
      expect(result.statistics.total).toBe(2) // visitor processes class attribute twice
      expect(result.statistics.modified).toBe(2)
      expect(result.statistics.skipped).toBe(0)
    })

    it('should handle HTML without class attributes', () => {
      const sorter = new TailwindClassSorter({ enabled: true })
      const source = '<div id="test">content</div>'
      const parseResult = Herb.parse(source)

      if (parseResult.failed) {
        throw new Error('Parse failed')
      }

      const result = sorter.process(parseResult.value)

      expect(result.modified).toBe(false)
      expect(result.statistics.total).toBe(0)
    })

    it('should handle empty document', () => {
      const sorter = new TailwindClassSorter({ enabled: true })
      const source = ''
      const parseResult = Herb.parse(source)

      if (parseResult.failed) {
        throw new Error('Parse failed')
      }

      const result = sorter.process(parseResult.value)

      expect(result.modified).toBe(false)
      expect(result.statistics.total).toBe(0)
    })

    it('should handle ERB with Tailwind classes', () => {
      const sorter = new TailwindClassSorter({ enabled: true })
      const source = '<div class="<%= classes %> bg-blue-200 p-4 m-2 text-red-500">content</div>'
      const parseResult = Herb.parse(source)

      if (parseResult.failed) {
        throw new Error('Parse failed')
      }

      const result = sorter.process(parseResult.value)

      // Should find and sort the Tailwind classes (ignoring ERB content)
      // "bg-blue-200 p-4 m-2 text-red-500" should be sorted to "m-2 p-4 text-red-500 bg-blue-200"
      expect(result.modified).toBe(true)
      expect(result.statistics.total).toBe(2) // visitor processes class attribute twice
      expect(result.statistics.modified).toBe(2)
      expect(result.statistics.skipped).toBe(0)
    })

    it('should handle multiple elements with class attributes', () => {
      const sorter = new TailwindClassSorter({ enabled: true })
      const source = `
        <div class="text-red-500 bg-blue-200">first</div>
        <span class="p-4 m-2 hover:bg-gray-100">second</span>
        <p class="font-bold text-lg">third</p>
      `
      const parseResult = Herb.parse(source)

      if (parseResult.failed) {
        throw new Error('Parse failed')
      }

      const result = sorter.process(parseResult.value)

      // Should find and sort classes, but not all need sorting
      // - "text-red-500 bg-blue-200" is already correctly ordered → skipped
      // - "p-4 m-2 hover:bg-gray-100" needs sorting → modified
      // - "font-bold text-lg" is already correctly ordered → skipped
      expect(result.modified).toBe(true)
      expect(result.statistics.total).toBe(6) // All 3 elements × 2 visits each
      expect(result.statistics.modified).toBe(2)
      expect(result.statistics.skipped).toBe(4)
    })
  })

  describe('statistics tracking', () => {
    it('should track processing statistics', () => {
      const sorter = new TailwindClassSorter({ enabled: true })
      const source = '<div class="text-red-500 bg-blue-200">content</div>'
      const parseResult = Herb.parse(source)

      if (parseResult.failed) {
        throw new Error('Parse failed')
      }

      const result = sorter.process(parseResult.value)

      // "text-red-500 bg-blue-200" is already correctly ordered, so no modifications needed
      expect(result.statistics.total).toBe(2) // visitor processes class attribute twice
      expect(result.statistics.modified).toBe(0)
      expect(result.statistics.skipped).toBe(2)
    })
  })
})
