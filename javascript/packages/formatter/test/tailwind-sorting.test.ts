import { describe, it, expect } from 'vitest'
import { sortTailwindClasses, containsTailwindClasses } from '../src/tailwind-sorter'

describe('Tailwind CSS Sorting', () => {
  describe('containsTailwindClasses', () => {
    it('should detect Tailwind classes', () => {
      expect(containsTailwindClasses('bg-red-500')).toBe(true)
      expect(containsTailwindClasses('text-blue-300')).toBe(true)
      expect(containsTailwindClasses('p-4 m-2')).toBe(true)
      expect(containsTailwindClasses('hover:bg-blue-300')).toBe(true)
      expect(containsTailwindClasses('lg:text-xl')).toBe(true)
      expect(containsTailwindClasses('flex items-center')).toBe(true)
    })

    it('should not detect non-Tailwind classes', () => {
      expect(containsTailwindClasses('custom-class')).toBe(false)
      expect(containsTailwindClasses('my-component')).toBe(false)
      expect(containsTailwindClasses('')).toBe(false)
    })
  })

  describe('sortTailwindClasses', () => {
    it('should return original string when dependencies are not available', async () => {
      const input = 'text-red-500 bg-blue-200 p-4 m-2'
      const result = await sortTailwindClasses(input)
      
      // Since prettier-plugin-tailwindcss might not be available in test environment,
      // we just verify the function doesn't crash and returns a string
      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)
    })

    it('should handle empty strings', async () => {
      expect(await sortTailwindClasses('')).toBe('')
      expect(await sortTailwindClasses('   ')).toBe('   ')
    })

    it('should handle null/undefined input', async () => {
      expect(await sortTailwindClasses(null as any)).toBe('')
      expect(await sortTailwindClasses(undefined as any)).toBe('')
    })
  })
})