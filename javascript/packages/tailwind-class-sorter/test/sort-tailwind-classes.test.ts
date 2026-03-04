import { describe, it, expect } from 'vitest'
import { sortTailwindClasses, sortTailwindClassList } from '../src/index'

describe('sortTailwindClasses', () => {
  it('sorts classes in the correct order', async () => {
    const input = 'px-4 bg-blue-500 text-white rounded py-2'
    const result = await sortTailwindClasses(input)

    expect(result).toBe('rounded bg-blue-500 px-4 py-2 text-white')
  })

  it('handles empty strings', async () => {
    expect(await sortTailwindClasses('')).toBe('')
    expect(await sortTailwindClasses(' ')).toBe(' ')
  })

  it('preserves single classes', async () => {
    expect(await sortTailwindClasses('px-4')).toBe('px-4')
  })

  it('handles responsive classes correctly', async () => {
    const input = 'text-sm md:text-lg lg:text-xl'
    const result = await sortTailwindClasses(input)

    expect(result).toBe('text-sm md:text-lg lg:text-xl')
  })

  it('sorts complex class combinations', async () => {
    const input = 'hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-blue-500 text-white px-4 py-2 rounded'
    const result = await sortTailwindClasses(input)

    expect(result).toBe('rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300')
  })

  it('removes duplicates by default', async () => {
    const input = 'px-4 px-4 bg-blue-500'
    const result = await sortTailwindClasses(input)
    expect(result).toBe('bg-blue-500 px-4')
  })

  it('preserves duplicates when configured', async () => {
    const input = 'px-4 px-4 bg-blue-500'
    const result = await sortTailwindClasses(input, {
      tailwindPreserveDuplicates: true
    })

    expect(result).toBe('bg-blue-500 px-4 px-4')
  })

  it('ignores classes with template syntax', async () => {
    const input = 'px-4 {{ some_template_var }} bg-blue-500'
    const result = await sortTailwindClasses(input)

    expect(result).toBe(input)
  })
})

describe('sortTailwindClassList', () => {
  it('sorts an array of classes', async () => {
    const input = ['px-4', 'bg-blue-500', 'text-white', 'rounded', 'py-2']
    const result = await sortTailwindClassList(input)

    expect(result.classList).toEqual(['rounded', 'bg-blue-500', 'px-4', 'py-2', 'text-white'])
    expect(result.removedIndices.size).toBe(0)
  })

  it('removes duplicates and tracks indices', async () => {
    const input = ['px-4', 'bg-blue-500', 'px-4', 'text-white']
    const result = await sortTailwindClassList(input)

    expect(result.classList).toEqual(['bg-blue-500', 'px-4', 'text-white'])
    expect(result.removedIndices.has(2)).toBe(true)
  })

  it('handles empty arrays', async () => {
    const result = await sortTailwindClassList([])

    expect(result.classList).toEqual([])
    expect(result.removedIndices.size).toBe(0)
  })
})

describe('config options', () => {
  it('works without config file', async () => {
    const result = await sortTailwindClasses('px-4 bg-blue-500')

    expect(result).toBe('bg-blue-500 px-4')
  })

  it('accepts baseDir option', async () => {
    const result = await sortTailwindClasses('px-4 bg-blue-500', {
      baseDir: process.cwd()
    })

    expect(result).toBe('bg-blue-500 px-4')
  })

  it('accepts tailwindPreserveWhitespace option', async () => {
    const result = await sortTailwindClasses(' px-4 bg-blue-500 ', {
      tailwindPreserveWhitespace: true
    })

    expect(result.startsWith(' ')).toBe(true)
    expect(result.endsWith(' ')).toBe(true)
  })
})
