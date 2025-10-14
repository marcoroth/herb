import path from 'path'
import { describe, it, expect } from 'vitest'
import { sortTailwindClasses } from '../src/index'

const v4StylesheetPath = path.join(__dirname, 'fixtures', 'v4-theme.css')

describe('sortTailwindClasses with TailwindCSS v4 stylesheet support', () => {
  it('accepts tailwindStylesheet option (v4 CSS config)', async () => {
    const input = 'px-4 bg-neon-pink text-white bg-blue-500 text-brand-primary'
    const result = await sortTailwindClasses(input, {
      tailwindStylesheet: v4StylesheetPath
    })

    expect(result).toBe('bg-neon-pink text-brand-primary bg-blue-500 px-4 text-white')
  })

  it('handles v4 stylesheet with standard classes', async () => {
    const input = 'bg-accent-900 text-accent-50 border-accent-100 bg-accent-500'
    const result = await sortTailwindClasses(input, {
      tailwindStylesheet: v4StylesheetPath
    })

    expect(result).toBe('bg-accent-900 text-accent-50 border-accent-100 bg-accent-500')
  })

  it('sorts with v4 stylesheet but fallback behavior', async () => {
    const input = 'p-88 m-18 p-4 m-2'
    const result = await sortTailwindClasses(input, {
      tailwindStylesheet: v4StylesheetPath
    })

    expect(result).toBe('p-88 m-18 m-2 p-4')
  })

  it('handles typography with v4 stylesheet', async () => {
    const input = 'text-custom-xl text-sm text-custom-sm text-base font-display'
    const result = await sortTailwindClasses(input, {
      tailwindStylesheet: v4StylesheetPath
    })

    expect(result).toBe('text-custom-xl text-custom-sm font-display text-base text-sm')
  })

  it('processes complex class combinations with v4 stylesheet option', async () => {
    const input = 'flex items-center bg-neon-lime text-brand-secondary p-88 hover:bg-blue-600 rounded-lg shadow-md'
    const result = await sortTailwindClasses(input, {
      tailwindStylesheet: v4StylesheetPath
    })

    expect(result).toBe('bg-neon-lime text-brand-secondary p-88 flex items-center rounded-lg shadow-md hover:bg-blue-600')
  })

  it('maintains color grouping with v4 stylesheet', async () => {
    const input = 'bg-neon-pink text-neon-cyan border-neon-lime hover:bg-accent-500'
    const result = await sortTailwindClasses(input, {
      tailwindStylesheet: v4StylesheetPath
    })

    expect(result).toBe('bg-neon-pink text-neon-cyan border-neon-lime hover:bg-accent-500')
  })

  it('handles responsive classes with v4 stylesheet', async () => {
    const input = 'text-sm md:text-lg 3xl:text-custom-xl lg:text-xl'
    const result = await sortTailwindClasses(input, {
      tailwindStylesheet: v4StylesheetPath
    })

    expect(result).toBe('3xl:text-custom-xl text-sm md:text-lg lg:text-xl')
  })

  it('handles missing v4 stylesheet gracefully', async () => {
    const originalWarn = console.warn
    console.warn = () => {}

    const input = 'px-4 bg-neon-pink text-white'
    const result = await sortTailwindClasses(input, {
      tailwindStylesheet: './non-existent-v4-theme.css'
    })

    expect(result).toBe('bg-neon-pink px-4 text-white')

    console.warn = originalWarn
  })

  it('compares v4 stylesheet vs no config behavior', async () => {
    const input = 'px-4 bg-neon-pink bg-blue-500 unknown-class'

    const resultWithoutConfig = await sortTailwindClasses(input)
    const resultWithV4Config = await sortTailwindClasses(input, {
      tailwindStylesheet: v4StylesheetPath
    })

    expect(resultWithoutConfig).toBe('bg-neon-pink unknown-class bg-blue-500 px-4')
    expect(resultWithV4Config).toBe('bg-neon-pink unknown-class bg-blue-500 px-4')
  })

  it('validates v4 stylesheet option is accepted', async () => {
    const jsConfigPath = path.join(__dirname, 'fixtures', 'tailwind.config.js')
    const input = 'bg-custom-primary px-4 text-white'

    const resultWithJSConfig = await sortTailwindClasses(input, {
      tailwindConfig: jsConfigPath,
    })

    const resultWithV4Stylesheet = await sortTailwindClasses(input, {
      tailwindStylesheet: v4StylesheetPath
    })

    expect(resultWithJSConfig).toBe('bg-custom-primary px-4 text-white')
    expect(resultWithV4Stylesheet).toBe('bg-custom-primary px-4 text-white')
  })
})
