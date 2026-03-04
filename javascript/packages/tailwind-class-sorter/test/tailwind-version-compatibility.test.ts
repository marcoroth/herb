import path from 'path'
import { describe, it, expect } from 'vitest'
import { sortTailwindClasses, TailwindClassSorter } from '../src/index'

const v3ConfigPath = path.join(__dirname, 'fixtures', 'tailwind.config.js')
const v4StylesheetPath = path.join(__dirname, 'fixtures', 'v4-theme.css')

describe('Tailwind v3 and v4 Compatibility', () => {
  describe('Tailwind v3 Support (with JS config)', () => {
    it('should work with Tailwind v3 config file', async () => {
      const input = 'px-4 bg-blue-500 text-white rounded py-2'
      const result = await sortTailwindClasses(input, {
        tailwindConfig: v3ConfigPath
      })

      expect(result).toBe('rounded bg-blue-500 px-4 py-2 text-white')
    })

    it('should handle custom colors from v3 config', async () => {
      const input = 'bg-custom-primary text-custom-secondary px-4'
      const result = await sortTailwindClasses(input, {
        tailwindConfig: v3ConfigPath
      })

      expect(result).toBe('bg-custom-primary px-4 text-custom-secondary')
    })

    it('should work with TailwindClassSorter for v3', async () => {
      const sorter = await TailwindClassSorter.fromConfig({
        tailwindConfig: v3ConfigPath
      })

      const result = sorter.sortClasses('hover:bg-primary focus:outline-none px-4')
      expect(result).toBe('hover:bg-primary px-4 focus:outline-none')
    })

    it('should handle multiple sorts with same v3 sorter instance', async () => {
      const sorter = await TailwindClassSorter.fromConfig({
        tailwindConfig: v3ConfigPath
      })

      const result1 = sorter.sortClasses('px-4 bg-blue-500 text-white')
      const result2 = sorter.sortClasses('grid gap-4 mt-8 grid-cols-3')

      expect(result1).toBe('bg-blue-500 px-4 text-white')
      expect(result2).toBe('mt-8 grid grid-cols-3 gap-4')
    })
  })

  describe('Tailwind v4 Support (with CSS stylesheet)', () => {
    it('should work with Tailwind v4 stylesheet', async () => {
      const input = 'px-4 bg-neon-pink text-white rounded py-2'
      const result = await sortTailwindClasses(input, {
        tailwindStylesheet: v4StylesheetPath
      })

      expect(result).toBe('bg-neon-pink rounded px-4 py-2 text-white')
    })

    it('should handle v4 custom colors', async () => {
      const input = 'bg-neon-pink text-brand-primary hover:bg-neon-lime'
      const result = await sortTailwindClasses(input, {
        tailwindStylesheet: v4StylesheetPath
      })

      expect(result).toBe('bg-neon-pink text-brand-primary hover:bg-neon-lime')
    })

    it('should work with TailwindClassSorter for v4', async () => {
      const sorter = await TailwindClassSorter.fromConfig({
        tailwindStylesheet: v4StylesheetPath
      })

      const result = sorter.sortClasses('hover:bg-neon-lime focus:outline-none px-4')
      expect(result).toBe('hover:bg-neon-lime px-4 focus:outline-none')
    })

    it('should handle multiple sorts with same v4 sorter instance', async () => {
      const sorter = await TailwindClassSorter.fromConfig({
        tailwindStylesheet: v4StylesheetPath
      })

      const result1 = sorter.sortClasses('px-4 bg-neon-pink text-white')
      const result2 = sorter.sortClasses('flex items-center gap-4 bg-accent-500')

      expect(result1).toBe('bg-neon-pink px-4 text-white')
      expect(result2).toBe('bg-accent-500 flex items-center gap-4')
    })
  })

  describe('Fallback to default when no config', () => {
    it('should work without any config (default Tailwind)', async () => {
      const input = 'px-4 bg-blue-500 text-white rounded py-2'
      const result = await sortTailwindClasses(input)

      expect(result).toBe('rounded bg-blue-500 px-4 py-2 text-white')
    })

    it('should handle standard Tailwind classes without config', async () => {
      const input = 'flex items-center justify-between gap-4 p-4'
      const result = await sortTailwindClasses(input)

      expect(result).toBe('flex items-center justify-between gap-4 p-4')
    })

    it('should work with TailwindClassSorter without config', async () => {
      const sorter = await TailwindClassSorter.fromConfig()

      const result = sorter.sortClasses('hover:bg-blue-600 px-4 bg-blue-500')
      expect(result).toBe('bg-blue-500 px-4 hover:bg-blue-600')
    })
  })

  describe('Edge cases and error handling', () => {
    it('should handle empty class string', async () => {
      const result = await sortTailwindClasses('', {
        tailwindConfig: v3ConfigPath
      })

      expect(result).toBe('')
    })

    it('should handle single class', async () => {
      const result = await sortTailwindClasses('px-4', {
        tailwindConfig: v3ConfigPath
      })

      expect(result).toBe('px-4')
    })

    it('should handle unknown classes gracefully with v3', async () => {
      const input = 'unknown-class px-4 another-unknown bg-blue-500'
      const result = await sortTailwindClasses(input, {
        tailwindConfig: v3ConfigPath
      })

      expect(result).toContain('unknown-class')
      expect(result).toContain('another-unknown')
      expect(result).toContain('px-4')
      expect(result).toContain('bg-blue-500')
    })

    it('should handle unknown classes gracefully with v4', async () => {
      const input = 'unknown-class px-4 another-unknown bg-neon-pink'
      const result = await sortTailwindClasses(input, {
        tailwindStylesheet: v4StylesheetPath
      })

      expect(result).toBe('unknown-class another-unknown bg-neon-pink px-4')
    })

    it('should handle non-existent config file gracefully', async () => {
      const originalWarn = console.warn
      const warnings: string[] = []
      console.warn = (...args: any[]) => warnings.push(args.join(' '))

      const input = 'px-4 bg-blue-500'
      const result = await sortTailwindClasses(input, {
        tailwindConfig: './non-existent.config.js'
      })

      expect(result).toBe('bg-blue-500 px-4')

      console.warn = originalWarn
    })
  })

  describe('Preserve options', () => {
    it('should preserve duplicates when requested with v3', async () => {
      const input = 'px-4 bg-blue-500 px-4 text-white'
      const result = await sortTailwindClasses(input, {
        tailwindConfig: v3ConfigPath,
        tailwindPreserveDuplicates: true
      })

      expect(result).toBe('bg-blue-500 px-4 px-4 text-white')
    })

    it('should remove duplicates by default with v3', async () => {
      const input = 'px-4 bg-blue-500 px-4 text-white'
      const result = await sortTailwindClasses(input, {
        tailwindConfig: v3ConfigPath,
        tailwindPreserveDuplicates: false
      })

      expect(result).toBe('bg-blue-500 px-4 text-white')
    })

    it('should preserve whitespace when requested', async () => {
      const input = 'px-4  bg-blue-500   text-white'
      const result = await sortTailwindClasses(input, {
        tailwindConfig: v3ConfigPath,
        tailwindPreserveWhitespace: true
      })

      expect(result).toBe('bg-blue-500  px-4   text-white')
    })
  })

  describe('Real-world scenarios', () => {
    it('should handle complex component classes with v3', async () => {
      const input = 'hover:shadow-lg transition-all duration-300 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
      const result = await sortTailwindClasses(input, {
        tailwindConfig: v3ConfigPath
      })

      expect(result).toBe('rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition-all duration-300 hover:bg-blue-700 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 active:scale-95')
    })

    it('should handle complex component classes with v4', async () => {
      const input = 'hover:shadow-lg transition-all duration-300 px-6 py-3 bg-neon-pink text-white rounded-lg font-semibold hover:bg-accent-500 active:scale-95'
      const result = await sortTailwindClasses(input, {
        tailwindStylesheet: v4StylesheetPath
      })

      expect(result).toBe('bg-neon-pink hover:bg-accent-500 rounded-lg px-6 py-3 font-semibold text-white transition-all duration-300 hover:shadow-lg active:scale-95')
    })

    it('should handle responsive design classes with v3', async () => {
      const input = 'text-sm md:text-base lg:text-lg xl:text-xl 2xl:text-2xl px-4 md:px-6 lg:px-8'
      const result = await sortTailwindClasses(input, {
        tailwindConfig: v3ConfigPath
      })

      expect(result).toBe('px-4 text-sm md:px-6 md:text-base lg:px-8 lg:text-lg xl:text-xl 2xl:text-2xl')
    })

    it('should handle grid and flexbox layouts', async () => {
      const input = 'grid-cols-3 grid gap-4 md:grid-cols-4 lg:grid-cols-6 px-4 container mx-auto'
      const result = await sortTailwindClasses(input, {
        tailwindConfig: v3ConfigPath
      })

      expect(result).toBe('container mx-auto grid grid-cols-3 gap-4 px-4 md:grid-cols-4 lg:grid-cols-6')
    })
  })
})
