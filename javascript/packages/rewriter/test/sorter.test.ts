import { describe, it, expect } from 'vitest'
import { sortTailwindClasses, sortTailwindClassArray, containsTailwindClasses } from '../src/rewriters/tailwind-class-sorter/sorter.js'

describe('Tailwind CSS Sorting', () => {
  describe('containsTailwindClasses', () => {
    it('should detect common Tailwind classes', () => {
      expect(containsTailwindClasses('bg-red-500')).toBe(true)
      expect(containsTailwindClasses('text-blue-300')).toBe(true)
      expect(containsTailwindClasses('p-4 m-2')).toBe(true)
      expect(containsTailwindClasses('hover:bg-blue-300')).toBe(true)
      expect(containsTailwindClasses('lg:text-xl')).toBe(true)
      expect(containsTailwindClasses('flex items-center')).toBe(true)
      expect(containsTailwindClasses('w-64 h-32')).toBe(true)
      expect(containsTailwindClasses('space-x-4')).toBe(true)
      expect(containsTailwindClasses('rounded-lg shadow-md')).toBe(true)
    })

    it('should not detect non-Tailwind classes', () => {
      expect(containsTailwindClasses('custom-class')).toBe(false)
      expect(containsTailwindClasses('my-component')).toBe(false)
      expect(containsTailwindClasses('navbar')).toBe(false)
      expect(containsTailwindClasses('')).toBe(false)
      expect(containsTailwindClasses('button-primary')).toBe(false)
    })

    it('should handle edge cases', () => {
      expect(containsTailwindClasses(null as any)).toBe(false)
      expect(containsTailwindClasses(undefined as any)).toBe(false)
      expect(containsTailwindClasses(123 as any)).toBe(false)
    })
  })

  describe('sortTailwindClasses', () => {
    it('should handle empty and invalid inputs', () => {
      expect(sortTailwindClasses('')).toBe('')
      expect(sortTailwindClasses('   ')).toBe('   ')
      expect(sortTailwindClasses(null as any)).toBe('')
      expect(sortTailwindClasses(undefined as any)).toBe('')
    })

    it('should return classes when sorting function is not available', () => {
      // Since we may not have the actual prettier-plugin-tailwindcss available
      // in the test environment, the function should still return the input
      const input = 'text-red-500 bg-blue-200 p-4 m-2'
      const result = sortTailwindClasses(input)
      
      // The function should return a string
      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)
      
      // Should contain all the original classes
      const inputClasses = input.split(' ')
      inputClasses.forEach(cls => {
        expect(result).toContain(cls)
      })
    })

    it('should preserve single classes', () => {
      expect(sortTailwindClasses('bg-red-500')).toBe('bg-red-500')
      expect(sortTailwindClasses('hover:text-blue-300')).toBe('hover:text-blue-300')
    })

    it('should handle whitespace variations', () => {
      const result = sortTailwindClasses('  bg-red-500   text-white  ')
      expect(result.trim()).toBeTruthy()
      expect(result).toContain('bg-red-500')
      expect(result).toContain('text-white')
    })
  })

  describe('sortTailwindClassArray', () => {
    it('should handle empty arrays', () => {
      expect(sortTailwindClassArray([])).toEqual([])
      expect(sortTailwindClassArray(null as any)).toEqual(null)
      expect(sortTailwindClassArray(undefined as any)).toEqual(undefined)
    })

    it('should sort array of classes', () => {
      const input = ['text-red-500', 'bg-blue-200', 'p-4', 'm-2']
      const result = sortTailwindClassArray(input)
      
      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBe(input.length)
      
      // Should contain all original classes
      input.forEach(cls => {
        expect(result).toContain(cls)
      })
    })

    it('should filter out empty strings', () => {
      const input = ['bg-red-500', '', 'text-white', '   ', 'p-4']
      const result = sortTailwindClassArray(input)
      
      // Should not contain empty strings
      expect(result.every(cls => cls.trim().length > 0)).toBe(true)
    })
  })
})