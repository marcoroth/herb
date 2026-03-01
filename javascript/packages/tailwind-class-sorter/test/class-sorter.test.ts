import path from 'path'
import { describe, it, expect } from 'vitest'
import { TailwindClassSorter } from '../src/sorter'
import { getTailwindConfig } from '../src/config'

const configPath = path.join(__dirname, 'fixtures', 'tailwind.config.js')

describe('TailwindClassSorter class', () => {
  describe('fromConfig static method', () => {
    it('creates sorter instance from config file', async () => {
      const sorter = await TailwindClassSorter.fromConfig({
        tailwindConfig: configPath
      })

      expect(sorter).toBeInstanceOf(TailwindClassSorter)
    })

    it('creates sorter instance with default config', async () => {
      const sorter = await TailwindClassSorter.fromConfig()

      expect(sorter).toBeInstanceOf(TailwindClassSorter)
    })
  })

  describe('constructor with context container', () => {
    it('creates sorter from pre-loaded context', async () => {
      const contextContainer = await getTailwindConfig({
        tailwindConfig: configPath
      })

      const sorter = new TailwindClassSorter(contextContainer, {
        tailwindPreserveDuplicates: true
      })

      expect(sorter).toBeInstanceOf(TailwindClassSorter)
      expect(sorter.getOptions().tailwindPreserveDuplicates).toBe(true)
    })
  })

  describe('synchronous sorting methods', () => {
    it('sorts classes synchronously with fromConfig', async () => {
      const sorter = await TailwindClassSorter.fromConfig({
        tailwindConfig: configPath
      })

      const result = sorter.sortClasses('px-4 bg-custom-primary text-white bg-blue-500 text-custom-secondary')

      expect(result).toBe('bg-blue-500 bg-custom-primary px-4 text-custom-secondary text-white')
    })

    it('sorts class list synchronously', async () => {
      const sorter = await TailwindClassSorter.fromConfig({
        tailwindConfig: configPath
      })

      const result = sorter.sortClassList(['px-4', 'bg-custom-primary', 'text-white', 'bg-blue-500'])

      expect(result.classList).toEqual(['bg-blue-500', 'bg-custom-primary', 'px-4', 'text-white'])
      expect(result.removedIndices).toEqual(new Set())
    })

    it('handles duplicate removal in class list', async () => {
      const sorter = await TailwindClassSorter.fromConfig()

      const result = sorter.sortClassList(['px-4', 'bg-blue-500', 'px-4', 'text-white'])

      expect(result.classList).toEqual(['bg-blue-500', 'px-4', 'text-white'])
      expect(result.removedIndices).toEqual(new Set([2])) // duplicate px-4 at index 2
    })

    it('preserves duplicates when option is set', async () => {
      const sorter = await TailwindClassSorter.fromConfig({
        tailwindPreserveDuplicates: true
      })

      const result = sorter.sortClassList(['px-4', 'bg-blue-500', 'px-4', 'text-white'])

      expect(result.classList).toEqual(['bg-blue-500', 'px-4', 'px-4', 'text-white'])
      expect(result.removedIndices).toEqual(new Set())
    })
  })

  describe('option override', () => {
    it('allows overriding options per sort for classes', async () => {
      const sorter = await TailwindClassSorter.fromConfig({
        tailwindPreserveDuplicates: false
      })

      const result1 = sorter.sortClasses('px-4  bg-blue-500  px-4  text-white', {
        tailwindPreserveDuplicates: true,
        tailwindPreserveWhitespace: true
      })

      const result2 = sorter.sortClasses('px-4  bg-blue-500  px-4  text-white')

      expect(result1).toBe('bg-blue-500  px-4  px-4  text-white')
      expect(result2).toBe('bg-blue-500 px-4 text-white')
    })

    it('allows overriding options per sort for class list', async () => {
      const sorter = await TailwindClassSorter.fromConfig({
        tailwindPreserveDuplicates: false
      })

      const input = ['px-4', 'bg-blue-500', 'px-4', 'text-white']

      const result1 = sorter.sortClassList(input, {
        tailwindPreserveDuplicates: true
      })

      const result2 = sorter.sortClassList(input)

      expect(result1.classList).toEqual(['bg-blue-500', 'px-4', 'px-4', 'text-white'])
      expect(result1.removedIndices).toEqual(new Set())

      expect(result2.classList).toEqual(['bg-blue-500', 'px-4', 'text-white'])
      expect(result2.removedIndices).toEqual(new Set([2]))
    })
  })

  describe('utility methods', () => {
    it('returns context container', async () => {
      const originalContext = await getTailwindConfig({
        tailwindConfig: configPath
      })
      const sorter = new TailwindClassSorter(originalContext)

      const context = sorter.getContext()

      expect(context).toHaveProperty('context')
      expect(context).toHaveProperty('generateRules')
      expect(typeof context.generateRules).toBe('function')
    })

    it('returns current options', async () => {
      const sorter = await TailwindClassSorter.fromConfig({
        tailwindConfig: configPath,
        tailwindPreserveDuplicates: true,
        tailwindPreserveWhitespace: true
      })

      const options = sorter.getOptions()

      expect(options.tailwindConfig).toBe(configPath)
      expect(options.tailwindPreserveDuplicates).toBe(true)
      expect(options.tailwindPreserveWhitespace).toBe(true)
    })

    it('returns copy of options (not reference)', async () => {
      const sorter = await TailwindClassSorter.fromConfig({
        tailwindPreserveDuplicates: true
      })

      const options1 = sorter.getOptions()
      const options2 = sorter.getOptions()

      expect(options1).not.toBe(options2)
      expect(options1).toEqual(options2)
    })
  })

  describe('edge cases', () => {
    it('handles empty strings', async () => {
      const sorter = await TailwindClassSorter.fromConfig()

      expect(sorter.sortClasses('')).toBe('')
      expect(sorter.sortClasses('   ')).toBe(' ')
    })

    it('handles non-string input', async () => {
      const sorter = await TailwindClassSorter.fromConfig()

      expect(sorter.sortClasses(null as any)).toBe(null)
      expect(sorter.sortClasses(undefined as any)).toBe(undefined)
    })

    it('handles empty arrays', async () => {
      const sorter = await TailwindClassSorter.fromConfig()

      const result = sorter.sortClassList([])
      expect(result.classList).toEqual([])
      expect(result.removedIndices).toEqual(new Set())
    })

    it('handles non-array input', async () => {
      const sorter = await TailwindClassSorter.fromConfig()

      const result = sorter.sortClassList(null as any)
      expect(result.classList).toBe(null)
      expect(result.removedIndices).toEqual(new Set())
    })
  })
})
