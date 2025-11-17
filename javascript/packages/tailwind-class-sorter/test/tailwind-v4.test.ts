import path from 'path'
import { describe, it, expect } from 'vitest'
import { sortTailwindClasses } from '../src/index'

const v4ProjectDir = path.join(__dirname, 'fixtures', 'project-v4')

describe('sortTailwindClasses with TailwindCSS v4 stylesheet support', () => {
  it('auto-detects v4 CSS config from baseDir', async () => {
    const input = 'px-4 bg-neon-pink text-white bg-blue-500 text-brand-primary'
    const result = await sortTailwindClasses(input, {
      baseDir: v4ProjectDir
    })

    expect(result).toBe('bg-blue-500 bg-neon-pink px-4 text-brand-primary text-white')
  })

  it('sorts custom v4 colors with modifiers', async () => {
    const input = 'hover:bg-brand-secondary text-white bg-brand-primary px-6'
    const result = await sortTailwindClasses(input, {
      baseDir: v4ProjectDir
    })

    expect(result).toBe('bg-brand-primary px-6 text-white hover:bg-brand-secondary')
  })

  it('handles v4 stylesheet with standard classes', async () => {
    const input = 'bg-accent-900 text-accent-50 border-accent-100 bg-accent-500'
    const result = await sortTailwindClasses(input, {
      baseDir: v4ProjectDir
    })

    expect(result).toBe('border-accent-100 bg-accent-500 bg-accent-900 text-accent-50')
  })

  it('sorts with v4 custom spacing', async () => {
    const input = 'p-88 m-18 p-4 m-2'
    const result = await sortTailwindClasses(input, {
      baseDir: v4ProjectDir
    })

    expect(result).toBe('m-2 m-18 p-4 p-88')
  })

  it('handles typography with v4 stylesheet', async () => {
    const input = 'text-custom-xl text-sm text-custom-sm text-base font-display'
    const result = await sortTailwindClasses(input, {
      baseDir: v4ProjectDir
    })

    expect(result).toBe('text-custom-xl text-custom-sm font-display text-base text-sm')
  })

  it('processes complex class combinations with v4 config', async () => {
    const input = 'flex items-center bg-neon-lime text-brand-secondary p-88 hover:bg-blue-600 rounded-lg shadow-md'
    const result = await sortTailwindClasses(input, {
      baseDir: v4ProjectDir
    })

    expect(result).toBe('flex items-center rounded-lg bg-neon-lime p-88 text-brand-secondary shadow-md hover:bg-blue-600')
  })

  it('maintains color grouping with v4 custom colors', async () => {
    const input = 'bg-neon-pink text-neon-cyan border-neon-lime hover:bg-accent-500'
    const result = await sortTailwindClasses(input, {
      baseDir: v4ProjectDir
    })

    expect(result).toBe('border-neon-lime bg-neon-pink text-neon-cyan hover:bg-accent-500')
  })

  it('handles responsive classes with v4 custom breakpoints', async () => {
    const input = 'text-sm md:text-lg 3xl:text-custom-xl lg:text-xl'
    const result = await sortTailwindClasses(input, {
      baseDir: v4ProjectDir
    })

    expect(result).toBe('3xl:text-custom-xl text-sm md:text-lg lg:text-xl')
  })

  it('compares v4 vs v3 config behavior', async () => {
    const v3ProjectDir = path.join(__dirname, 'fixtures', 'project-v3')
    const input = 'px-4 bg-neon-pink bg-blue-500 text-brand-primary'

    const resultWithV3 = await sortTailwindClasses(input, {
      baseDir: v3ProjectDir
    })

    const resultWithV4 = await sortTailwindClasses(input, {
      baseDir: v4ProjectDir
    })

    expect(resultWithV3).toBe('bg-blue-500 bg-neon-pink px-4 text-brand-primary')
    expect(resultWithV4).toBe('bg-blue-500 bg-neon-pink px-4 text-brand-primary')
  })

  it('handles missing config gracefully', async () => {
    const input = 'px-4 bg-neon-pink text-white'
    const result = await sortTailwindClasses(input, {
      baseDir: '/tmp/nonexistent-project-dir'
    })

    expect(result).toBe('px-4 bg-neon-pink text-white')
  })
})
